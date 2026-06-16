/**
 * specOps.ts — Spec rename, delete, and back-reference lookup.
 * Used by both routes/rename.ts and the MCP server.
 * See DESIGN.md "v5 feature design".
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { loadSpecs, guardPath } from './store.js';
import { parseSpecId, toSpecId, WIKILINK_PATTERN, type SpecMeta } from '../shared/types.js';

// ─── Error class ──────────────────────────────────────────────────────────────

/** Error with an HTTP status code, used for status mapping in route handlers. */
export class SpecOpsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SpecOpsError';
  }
}

// ─── Internal utilities ────────────────────────────────────────────────────────

/**
 * Return the absolute path for a spec, guarded against path traversal.
 * Throws SpecOpsError(400) when the resolved path is outside specsDir.
 */
function resolveSpecPath(specsDir: string, category: string, slug: string): string {
  const parts = category === '' ? [] : category.split('/');
  const filePath = path.join(specsDir, ...parts, `${slug}.mdx`);
  if (!guardPath(specsDir, filePath)) {
    throw new SpecOpsError(400, 'Path traversal is not allowed');
  }
  return filePath;
}

// ─── Fence / inline-code exclusion logic ──────────────────────────────────────

/**
 * Return [start, end) pairs for ranges that must not be rewritten.
 * Positions inside:
 * - fenced code blocks (``` or ~~~)
 * - inline code (`...`)
 * are excluded from wiki link replacement.
 */
function buildProtectedRanges(src: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  // Fenced code blocks: from a line starting with ``` or ~~~ to the closing fence
  // Backtick fence (3+ backticks)
  const fenceRe = /(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(src)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }

  // Inline code (`...`) — backticks inside fences are already covered by fence ranges;
  // extract single-backtick inline code (overlaps with fences are resolved by isProtected)
  const inlineRe = /`[^`\n]*`/g;
  while ((m = inlineRe.exec(src)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }

  // No sort/merge needed — isProtected checks each position individually
  return ranges;
}

/** Return true when pos falls within any protected range. */
function isProtected(pos: number, ranges: Array<[number, number]>): boolean {
  for (const [s, e] of ranges) {
    if (pos >= s && pos < e) return true;
  }
  return false;
}

/**
 * Rewrite wiki links in src whose target matches `from` to `to`.
 * Links inside fenced code blocks or inline code are left unchanged.
 * Line endings are not normalised (byte sequence is preserved as-is).
 */
function rewriteLinks(src: string, from: string, to: string): string {
  if (!src.includes(`[[${from}]]`) && !src.includes(`[[${from}|`)) {
    // Early exit: no matching links
    return src;
  }

  const protected_ = buildProtectedRanges(src);
  const re = new RegExp(WIKILINK_PATTERN.source, WIKILINK_PATTERN.flags);

  // Build result by concatenating substrings (splice-style to keep memory low)
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(src)) !== null) {
    const target = match[1]!.trim();
    if (target !== from) continue;
    if (isProtected(match.index, protected_)) continue;

    // Append text before the match unchanged
    result += src.slice(lastIndex, match.index);

    // Rewrite the link
    const label = match[2]; // undefined = no label
    if (label !== undefined) {
      result += `[[${to}|${label}]]`;
    } else {
      result += `[[${to}]]`;
    }

    lastIndex = match.index + match[0].length;
  }

  result += src.slice(lastIndex);
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * findRefs — Return a sorted list of spec IDs that reference id via wiki links.
 * The id itself is excluded.
 */
export async function findRefs(specsDir: string, id: string): Promise<string[]> {
  const specs = await loadSpecs(specsDir);
  const refs = specs
    .filter((s) => s.id !== id && s.links.includes(id))
    .map((s) => s.id)
    .sort();
  return refs;
}

/**
 * renameSpec — Rename a spec file and rewrite all wiki links across every spec.
 *
 * Validation:
 *   - Both from and to must be valid IDs per parseSpecId, or 400
 *   - slug "_" or "_template" is rejected with 400 (index/template cannot be renamed)
 *   - from must exist in loadSpecs, or 404
 *   - to must not already exist, or 409
 *   - to's category directory must exist, or 400 (we do not mkdir)
 *   - Path traversal → 400
 *
 * Rewrite behaviour:
 *   - Wiki links inside fenced code blocks or inline code are not changed
 *   - File line endings are not normalised
 *
 * @returns The new SpecMeta and a sorted list of spec IDs whose wiki links were rewritten.
 */
export async function renameSpec(
  specsDir: string,
  from: string,
  to: string,
): Promise<{ meta: SpecMeta; rewrittenFiles: string[] }> {
  // ── ID validation ──────────────────────────────────────────────────
  const parsedFrom = parseSpecId(from);
  if (!parsedFrom) {
    throw new SpecOpsError(400, `Invalid spec ID: ${from}`);
  }
  const parsedTo = parseSpecId(to);
  if (!parsedTo) {
    throw new SpecOpsError(400, `Invalid spec ID: ${to}`);
  }

  // Index and template slugs cannot be renamed
  if (parsedFrom.slug === '_' || parsedFrom.slug === '_template') {
    throw new SpecOpsError(400, 'Index and template specs cannot be renamed');
  }
  if (parsedTo.slug === '_' || parsedTo.slug === '_template') {
    throw new SpecOpsError(400, 'The target slug cannot be an index or template');
  }

  // ── Resolve file paths & path-traversal guard ──────────────────────
  const fromPath = resolveSpecPath(specsDir, parsedFrom.category, parsedFrom.slug);
  const toPath = resolveSpecPath(specsDir, parsedTo.category, parsedTo.slug);

  // ── Verify from exists ─────────────────────────────────────────────
  const specs = await loadSpecs(specsDir);
  const fromMeta = specs.find((s) => s.id === from);
  if (!fromMeta) {
    throw new SpecOpsError(404, `Spec not found: ${from}`);
  }

  // ── Verify to does not exist ───────────────────────────────────────
  const toExists = specs.some((s) => s.id === to);
  if (toExists) {
    throw new SpecOpsError(409, `Rename target already exists: ${to}`);
  }

  // ── Verify to's category directory exists ──────────────────────────
  const toCategoryDir = path.dirname(toPath);
  try {
    await fs.access(toCategoryDir);
  } catch {
    const relCategoryDir = path.relative(specsDir, toCategoryDir).split(path.sep).join('/');
    throw new SpecOpsError(400, `Target category directory does not exist: ${relCategoryDir}`);
  }

  // ── Rename file ────────────────────────────────────────────────────
  await fs.rename(fromPath, toPath);

  // ── Rewrite wiki links across all specs (including the renamed one) ─
  // Reload after rename to get the latest file list
  const specsAfter = await loadSpecs(specsDir);
  const rewrittenIds: string[] = [];

  await Promise.all(
    specsAfter.map(async (spec) => {
      // Note: the renamed spec is now listed under `to` (self-links are also rewritten)
      const parts = spec.category === '' ? [] : spec.category.split('/');
      const filePath = path.join(specsDir, ...parts, `${spec.slug}.mdx`);

      let content: string;
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch {
        return;
      }

      const rewritten = rewriteLinks(content, from, to);
      if (rewritten === content) return;

      await fs.writeFile(filePath, rewritten, 'utf-8');
      rewrittenIds.push(spec.id);
    }),
  );

  rewrittenIds.sort();

  // ── Load meta after rename ────────────────────────────────────────
  const { loadSpec } = await import('./store.js');
  const result = await loadSpec(specsDir, toPath);
  if (!result) {
    throw new SpecOpsError(500, 'Failed to read spec after rename');
  }

  return { meta: result.meta, rewrittenFiles: rewrittenIds };
}

/**
 * deleteSpec — Delete a spec file.
 *
 * Validation:
 *   - id must be valid per parseSpecId, or 400
 *   - id must exist in loadSpecs, or 404 (_template can also be deleted)
 *   - Path traversal → 400
 */
export async function deleteSpec(specsDir: string, id: string): Promise<void> {
  const parsed = parseSpecId(id);
  if (!parsed) {
    throw new SpecOpsError(400, `Invalid spec ID: ${id}`);
  }

  const filePath = resolveSpecPath(specsDir, parsed.category, parsed.slug);

  // Verify existence using loadSpecs — it also detects _template
  const specs = await loadSpecs(specsDir);
  const exists = specs.some((s) => s.id === id);
  if (!exists) {
    throw new SpecOpsError(404, `Spec not found: ${id}`);
  }

  await fs.unlink(filePath);
}
