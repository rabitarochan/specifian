/**
 * Lint core — shared by POST /api/lint and the MCP lint tool.
 * Collects all issues across four checks (yaml / mdx / wikilink / schema) and returns them.
 */

import matter from 'gray-matter';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import Ajv from 'ajv';
import { WIKILINK_PATTERN, type LintIssue, type LintRequest } from '../shared/types.js';
import { loadSpecs } from './store.js';
import { loadCategorySchema } from './validate.js';

/** Strip code fences and inline code (equivalent to stripCodeBlocks in store.ts). */
function stripCodeBlocks(src: string): string {
  let result = src.replace(/```[\s\S]*?```/g, '');
  result = result.replace(/`[^`]*`/g, '');
  return result;
}

/**
 * Extract wiki link IDs from the body (with front-matter already stripped).
 * Same algorithm as extractLinks in store.ts. Deduplicated.
 */
function extractWikilinkIds(body: string): string[] {
  const stripped = stripCodeBlocks(body);
  const seen = new Set<string>();
  const ids: string[] = [];
  const re = new RegExp(WIKILINK_PATTERN.source, WIKILINK_PATTERN.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const target = m[1].trim();
    if (!target.includes(':')) continue;
    if (!seen.has(target)) {
      seen.add(target);
      ids.push(target);
    }
  }
  return ids;
}

/**
 * Convert an AJV error to a human-readable message (mirrors the same logic in validate.ts).
 */
function ajvErrorToMessage(err: {
  instancePath: string;
  keyword: string;
  message?: string;
  params?: Record<string, unknown>;
}): string {
  let message = err.message ?? 'Validation error';

  if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
    message = `Missing required property: '${String(err.params['missingProperty'])}'`;
  } else if (err.keyword === 'additionalProperties' && err.params && 'additionalProperty' in err.params) {
    message = `Additional property not allowed: '${String(err.params['additionalProperty'])}'`;
  } else if (err.keyword === 'enum' && err.params && 'allowedValues' in err.params) {
    const allowed = (err.params['allowedValues'] as unknown[]).join(', ');
    message = `${err.message ?? 'Enum error'} (allowed values: ${allowed})`;
  } else if (err.keyword === 'type' && err.params && 'type' in err.params) {
    message = `Incorrect type: expected ${String(err.params['type'])}`;
  }

  return message;
}

/**
 * Run all four rules (yaml / mdx / wikilink / schema) and return every issue found.
 * All checks are executed even when earlier ones report errors.
 *
 * @param specsDir - Absolute path to the specs directory (used for wikilink resolution and schema loading)
 * @param req      - LintRequest (content is required; category/slug are optional)
 */
export async function lintContent(
  specsDir: string,
  req: LintRequest,
): Promise<LintIssue[]> {
  const issues: LintIssue[] = [];
  const { content, category, slug } = req;

  // --- 1. YAML parse (gray-matter) ---
  let frontmatterData: Record<string, unknown> = {};
  let bodyContent = content; // fallback: use the full text for wikilink/mdx checks
  let yamlFailed = false;

  try {
    const parsed = matter(content);
    frontmatterData = parsed.data as Record<string, unknown>;
    bodyContent = parsed.content;
  } catch (err) {
    yamlFailed = true;
    // gray-matter / js-yaml errors are Error or YAMLException. Attach line info when available.
    const e = err as Error & { mark?: { line?: number } };
    const rawLine = e.mark?.line;
    // js-yaml line is 0-based → convert to 1-based
    const line = typeof rawLine === 'number' ? rawLine + 1 : undefined;
    issues.push({
      severity: 'error',
      rule: 'yaml',
      message: `YAML parse error: ${e.message}`,
      ...(line !== undefined ? { line } : {}),
    });
    // On YAML failure, skip schema validation but continue mdx/wikilink checks against the full text.
    bodyContent = content;
  }

  // --- 2. MDX syntax check (@mdx-js/mdx compile) ---
  try {
    await compile(content, {
      remarkPlugins: [remarkGfm, remarkFrontmatter],
      // VFile messages (warnings) are not needed here
    });
  } catch (err) {
    // compile() throws a VFileMessage (a subclass of Error)
    const e = err as Error & {
      line?: number;
      column?: number;
      reason?: string;
    };
    const message = e.reason ?? e.message ?? 'MDX compile error';
    const issue: LintIssue = {
      severity: 'error',
      rule: 'mdx',
      message,
    };
    if (typeof e.line === 'number') issue.line = e.line;
    if (typeof e.column === 'number') issue.column = e.column;
    issues.push(issue);
  }

  // --- 3. Wiki link resolution check ---
  try {
    const allSpecs = await loadSpecs(specsDir);
    // Exclude _template (same as store.ts / search.ts); include _ index entries
    const knownIds = new Set(
      allSpecs.filter((s) => s.slug !== '_template').map((s) => s.id),
    );

    const ids = extractWikilinkIds(bodyContent);
    const seenUnresolved = new Set<string>();
    for (const id of ids) {
      if (!knownIds.has(id) && !seenUnresolved.has(id)) {
        seenUnresolved.add(id);
        issues.push({
          severity: 'warning',
          rule: 'wikilink',
          message: `Unresolved wiki link: [[${id}]]`,
        });
      }
    }
  } catch {
    // Skip wikilink check if the specs directory does not exist, etc.
  }

  // --- 4. Schema validation (only when category is specified and the spec is a normal one) ---
  // Skipped when YAML parsing failed (front-matter is unavailable)
  if (!yamlFailed && category !== undefined) {
    // Slugs '_' and '_template' are excluded from schema validation
    const effectiveSlug = slug ?? '';
    const isNormalSpec = effectiveSlug !== '_' && effectiveSlug !== '_template';

    if (isNormalSpec) {
      try {
        const schemaResult = await loadCategorySchema(specsDir, category);

        if (schemaResult.error !== undefined) {
          // Schema load errors are not reported as lint issues (server-side problem).
          // Can be added here if needed.
        } else if (schemaResult.schema !== null) {
          const ajv = new Ajv({ allErrors: true, strict: false });
          let validate: ReturnType<Ajv['compile']>;
          try {
            validate = ajv.compile(schemaResult.schema);
          } catch {
            // Schema compile errors are not reported as lint issues
            validate = null as unknown as ReturnType<Ajv['compile']>;
          }

          if (validate) {
            const valid = validate(frontmatterData);
            if (!valid && validate.errors) {
              for (const err of validate.errors) {
                const instancePath = err.instancePath || '/';
                const message = ajvErrorToMessage({
                  instancePath,
                  keyword: err.keyword,
                  message: err.message,
                  params: err.params as Record<string, unknown> | undefined,
                });
                issues.push({
                  severity: 'error',
                  rule: 'schema',
                  message: `${instancePath}: ${message}`,
                });
              }
            }
          }
        }
      } catch {
        // Skip unexpected errors during schema validation
      }
    }
  }

  return issues;
}
