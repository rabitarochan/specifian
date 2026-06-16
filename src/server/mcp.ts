/**
 * mcp.ts — specifian MCP server (stdio transport).
 *
 * Lets AI agents (e.g. Claude Code) read and write specifian spec documents
 * via MCP tools.
 *
 * Important: stdout is reserved for the MCP (JSON-RPC) protocol.
 *            Never write to stdout. All logging must go to console.error (stderr).
 *
 * Design: see docs/DESIGN.md "v5 feature design: MCP server".
 * Reuses existing server modules (store / searchCore / lintCore / specOps /
 * validate / generate) with the same semantics as the HTTP routes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadSpecs, loadSpec, guardPath } from './store.js';
import { searchSpecs } from './searchCore.js';
import { lintContent } from './lintCore.js';
import {
  findRefs,
  renameSpec,
  deleteSpec,
  SpecOpsError,
} from './specOps.js';
import { validateSpecs } from './validate.js';
import { runGenerator, listGenerators } from './generate.js';
import {
  parseSpecId,
  toSpecId,
  type SpecMeta,
  type LintIssue,
} from '../shared/types.js';

// ─── Tool result helpers ──────────────────────────────────────────────────────

/** Wrap any value as a JSON string text content (success response). */
function ok(result: unknown): {
  content: { type: 'text'; text: string }[];
} {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}

/** Error response (isError: true). Pass through the message from SpecOpsError etc. */
function fail(message: string): {
  content: { type: 'text'; text: string }[];
  isError: true;
} {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

/** Extract a human-readable message from an unknown error. */
function errMessage(err: unknown): string {
  if (err instanceof SpecOpsError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

// ─── Path resolution (same traversal guard as HTTP routes) ───────────────────

/**
 * Resolve the absolute MDX path from category + slug.
 * Returns null when the resolved path is outside specsDir (caller handles the error).
 * Same semantics as guardPath in routes/specs.ts.
 */
function resolveMdxPath(
  specsDir: string,
  category: string,
  slug: string,
): string | null {
  const parts = category === '' ? [] : category.split('/');
  const target = path.join(specsDir, ...parts, `${slug}.mdx`);
  if (!guardPath(specsDir, target)) return null;
  return target;
}

/** Rebuild the SpecMeta for the given ID from loadSpecs; returns null when not found. */
async function findMeta(specsDir: string, id: string): Promise<SpecMeta | null> {
  const specs = await loadSpecs(specsDir);
  return specs.find((s) => s.id === id) ?? null;
}

// ─── Server startup ───────────────────────────────────────────────────────────

/**
 * Start the specifian MCP server on a stdio transport.
 * The returned Promise does not resolve until the transport closes (equivalent to process exit).
 *
 * @param specsDir - Absolute path to the specs directory (caller must verify it exists)
 */
export async function startMcpServer(specsDir: string): Promise<void> {
  const server = new McpServer({ name: 'specifian', version: '0.1.0' });

  // ── list_specs ──────────────────────────────────────────────────────────
  server.registerTool(
    'list_specs',
    {
      description:
        'Return metadata (SpecMeta[]) for all specs in the specs directory. ' +
        'Each element includes id ("category:slug" format), category, slug, path, title, ' +
        'description, the full front-matter (data), wiki link target IDs in the body (links), ' +
        'and isIndex. _template is excluded.',
      inputSchema: {},
    },
    async () => {
      try {
        const specs = await loadSpecs(specsDir);
        return ok(specs.filter((s) => s.slug !== '_template'));
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── read_spec ───────────────────────────────────────────────────────────
  server.registerTool(
    'read_spec',
    {
      description:
        'Return the meta and content for the specified spec. ' +
        'id is in "category:slug" format (e.g. "tables:users"; index is "tables:_"). ' +
        'content is the raw MDX text including front-matter. ' +
        'Returns an error when the spec does not exist.',
      inputSchema: {
        id: z
          .string()
          .describe('Spec ID in "category:slug" format (e.g. "tables:users")'),
      },
    },
    async ({ id }) => {
      const parsed = parseSpecId(id);
      if (!parsed) return fail(`Invalid spec ID: ${id}`);
      const target = resolveMdxPath(specsDir, parsed.category, parsed.slug);
      if (!target) return fail('Path traversal is not allowed');
      const result = await loadSpec(specsDir, target);
      if (!result) return fail(`Spec not found: ${id}`);
      return ok(result);
    },
  );

  // ── write_spec ──────────────────────────────────────────────────────────
  server.registerTool(
    'write_spec',
    {
      description:
        'Overwrite the content of an existing spec. ' +
        'id is in "category:slug" format. content is the full MDX text including front-matter. ' +
        'Returns an error when the spec does not exist (use create_spec to create a new one). ' +
        'Runs lint after saving and returns { meta, issues }. ' +
        '(issues are informational — the save always completes.)',
      inputSchema: {
        id: z
          .string()
          .describe('ID of the existing spec to overwrite, in "category:slug" format'),
        content: z
          .string()
          .describe('Full MDX text including front-matter (replaces the entire file)'),
      },
    },
    async ({ id, content }) => {
      const parsed = parseSpecId(id);
      if (!parsed) return fail(`Invalid spec ID: ${id}`);
      const target = resolveMdxPath(specsDir, parsed.category, parsed.slug);
      if (!target) return fail('Path traversal is not allowed');

      // Only existing specs can be written (existence check)
      try {
        await fs.access(target);
      } catch {
        return fail(
          `Spec not found: ${id}. Use create_spec to create a new one.`,
        );
      }

      try {
        await fs.writeFile(target, content, 'utf-8');
      } catch (err) {
        return fail(`Failed to save: ${errMessage(err)}`);
      }

      const meta = await findMeta(specsDir, id);

      // Lint after save (lint failure does not affect save success)
      let issues: LintIssue[];
      try {
        issues = await lintContent(specsDir, {
          content,
          category: parsed.category,
          slug: parsed.slug,
        });
      } catch (lintErr) {
        console.error('[mcp] lintContent failed (ignored):', lintErr);
        issues = [];
      }

      return ok({ meta, issues });
    },
  );

  // ── create_spec ─────────────────────────────────────────────────────────
  server.registerTool(
    'create_spec',
    {
      description:
        'Create a new spec (same semantics as POST /api/specs). ' +
        'category is the category path ("/" separated, e.g. "tables" or "api/v1"); slug is the filename without extension. ' +
        'The category directory must already exist. ' +
        'Returns an error when a spec with the same name already exists. ' +
        'If _template.mdx exists in the category it is copied and its front-matter title is replaced; ' +
        'otherwise a minimal template (title + heading) is generated. Returns { meta }.',
      inputSchema: {
        category: z
          .string()
          .describe('Category path ("/" separated; empty string for root). Example: "tables"'),
        slug: z.string().describe('Spec filename without extension. Example: "users"'),
        title: z
          .string()
          .optional()
          .describe('front-matter title; defaults to slug when omitted'),
      },
    },
    async ({ category, slug, title }) => {
      if (!slug) return fail('slug is required');
      const cat = category ?? '';
      const effectiveTitle = title ?? slug;

      const target = resolveMdxPath(specsDir, cat, slug);
      if (!target) return fail('Path traversal is not allowed');

      const categoryParts = cat === '' ? [] : cat.split('/');
      const categoryDir = path.join(specsDir, ...categoryParts);

      // Verify category directory exists (MCP does not mkdir)
      try {
        const stat = await fs.stat(categoryDir);
        if (!stat.isDirectory()) {
          return fail(`Category path is not a directory: ${cat}`);
        }
      } catch {
        return fail(`Category directory does not exist: ${cat || '(root)'}`);
      }

      // Check for existing file (equivalent to 409)
      try {
        await fs.access(target);
        return fail(`"${slug}" already exists`);
      } catch {
        // Expected: file does not exist
      }

      // Apply template (or fall back to minimal template)
      let content: string;
      const templatePath = path.join(categoryDir, '_template.mdx');
      try {
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        const parsed = matter(templateContent);
        parsed.data['title'] = effectiveTitle;
        content = matter.stringify(parsed.content, parsed.data);
      } catch {
        content = `---\ntitle: ${effectiveTitle}\n---\n\n# ${effectiveTitle}\n`;
      }

      try {
        await fs.writeFile(target, content, 'utf-8');
      } catch (err) {
        return fail(`Failed to create: ${errMessage(err)}`);
      }

      const id = toSpecId(cat, slug);
      const meta = await findMeta(specsDir, id);
      if (!meta) return fail('Failed to read spec after creation');
      return ok({ meta });
    },
  );

  // ── rename_spec ─────────────────────────────────────────────────────────
  server.registerTool(
    'rename_spec',
    {
      description:
        'Rename a spec file and rewrite all wiki links [[from]] / [[from|label]] across every spec ' +
        'to [[to]] (links inside code fences and inline code are not changed). ' +
        'Both from and to are spec IDs in "category:slug" format. ' +
        "The target category directory must already exist. " +
        'Index (slug "_") and template (slug "_template") specs cannot be renamed. ' +
        'Returns { meta, rewrittenFiles } where rewrittenFiles is the list of spec IDs whose links were rewritten.',
      inputSchema: {
        from: z.string().describe('Source spec ID in "category:slug" format'),
        to: z.string().describe('Target spec ID in "category:slug" format'),
      },
    },
    async ({ from, to }) => {
      try {
        const result = await renameSpec(specsDir, from, to);
        return ok(result);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── delete_spec ─────────────────────────────────────────────────────────
  server.registerTool(
    'delete_spec',
    {
      description:
        'Delete a spec. id is in "category:slug" format. ' +
        'Back-references (specs that wiki-link to this id) are looked up before deletion, ' +
        'and the result { ok: true, brokenRefs } reports any broken references. ' +
        'When brokenRefs is non-empty, those specs will have unresolved links. ' +
        'Index (slug "_") and template specs can also be deleted.',
      inputSchema: {
        id: z.string().describe('Spec ID to delete, in "category:slug" format'),
      },
    },
    async ({ id }) => {
      try {
        // Collect back-references before deletion (they disappear from links afterwards)
        const refs = await findRefs(specsDir, id);
        await deleteSpec(specsDir, id);
        return ok({ ok: true, brokenRefs: refs });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── get_refs ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_refs',
    {
      description:
        'Return the list of spec IDs ({ refs }) that reference the given ID via wiki links. ' +
        'id is in "category:slug" format. Useful for checking back-links or assessing the impact of deletion.',
      inputSchema: {
        id: z.string().describe('Spec ID to look up back-references for, in "category:slug" format'),
      },
    },
    async ({ id }) => {
      try {
        const refs = await findRefs(specsDir, id);
        return ok({ refs });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── search ──────────────────────────────────────────────────────────────
  server.registerTool(
    'search',
    {
      description:
        'Full-text search across specs. Matches in priority order: title > description > front-matter (data) > body. ' +
        'Each hit includes a snippet (excerpt with surrounding context) and the matched field. ' +
        '_template is excluded. Returns SearchResult[].',
      inputSchema: {
        query: z.string().describe('Search query string (case-insensitive)'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results; defaults to 20'),
      },
    },
    async ({ query, limit }) => {
      try {
        const results = await searchSpecs(specsDir, query, limit ?? 20);
        return ok(results);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── get_data ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_data',
    {
      description:
        'Return front-matter (data) for specs in bulk. ' +
        'When category is omitted, returns { category: { slug: data } } nested structure (all categories). ' +
        'When category is specified, returns { slug: data } for that category only. ' +
        '_template is excluded. Useful for fetching a list of table definitions, etc.',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe('Category path ("/" separated); omit for all categories'),
      },
    },
    async ({ category }) => {
      try {
        const specs = await loadSpecs(specsDir);
        const filtered = specs.filter((s) => s.slug !== '_template');
        if (category === undefined) {
          const result: Record<string, Record<string, unknown>> = {};
          for (const spec of filtered) {
            const cat = spec.category;
            if (!result[cat]) result[cat] = {};
            (result[cat] as Record<string, unknown>)[spec.slug] = spec.data;
          }
          return ok(result);
        }
        const cat = category.split('/').filter(Boolean).join('/');
        const result: Record<string, unknown> = {};
        for (const spec of filtered) {
          if (spec.category === cat) result[spec.slug] = spec.data;
        }
        return ok(result);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── validate ────────────────────────────────────────────────────────────
  server.registerTool(
    'validate',
    {
      description:
        'For categories that have _schema.json, validate front-matter of all specs with JSON Schema (ajv) ' +
        'and return a violation list (ValidationReport { issues }). Empty issues means full conformance.',
      inputSchema: {},
    },
    async () => {
      try {
        const report = await validateSpecs(specsDir);
        return ok(report);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── lint ────────────────────────────────────────────────────────────────
  server.registerTool(
    'lint',
    {
      description:
        'Validate the full MDX text without saving and return issues (LintIssue[]). ' +
        'Checks: YAML parse / MDX syntax / wiki link resolution / (when category is given) schema validation. ' +
        'content is the full MDX text including front-matter. Passing category/slug also enables schema validation. ' +
        'Use this for pre-save validation.',
      inputSchema: {
        content: z.string().describe('Full MDX text including front-matter'),
        category: z
          .string()
          .optional()
          .describe('Category for schema validation; schema check is skipped when omitted'),
        slug: z
          .string()
          .optional()
          .describe('Target slug; "_" / "_template" are excluded from schema validation'),
      },
    },
    async ({ content, category, slug }) => {
      try {
        const issues = await lintContent(specsDir, { content, category, slug });
        return ok({ issues });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── list_generators ─────────────────────────────────────────────────────
  server.registerTool(
    'list_generators',
    {
      description:
        'Return the list of code generator names (string[]) under specs/_generators/. ' +
        'Use these names as the generator argument to the generate tool.',
      inputSchema: {},
    },
    async () => {
      try {
        const generators = await listGenerators(specsDir);
        return ok(generators);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── generate ────────────────────────────────────────────────────────────
  server.registerTool(
    'generate',
    {
      description:
        'Run a code generator. generator is a name obtained from list_generators. ' +
        'Specify specId ("category:slug") to target a single spec; omit for all specs. ' +
        'Specify out to write files to disk relative to the process cwd ' +
        '(omit to return the output without writing). Returns { files: { path, content }[] }.',
      inputSchema: {
        generator: z
          .string()
          .describe('Generator name (specs/_generators/<name>.md)'),
        specId: z
          .string()
          .optional()
          .describe('Target spec ID in "category:slug" format; omit for all specs'),
        out: z
          .string()
          .optional()
          .describe('Output directory (relative to cwd); omit to skip writing to disk'),
      },
    },
    async ({ generator, specId, out }) => {
      try {
        const allSpecs = await loadSpecs(specsDir);
        const files = await runGenerator(
          specsDir,
          generator,
          allSpecs,
          specId,
          out,
        );
        return ok({ files });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── Connect transport ─────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep the process alive until the transport closes.
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}
