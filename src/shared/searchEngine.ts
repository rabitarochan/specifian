/**
 * Full-text search engine — fs-independent pure logic.
 * Shared by the server (GET /api/search, MCP search tool via searchCore.ts)
 * and the client (static mode, where the search runs in the browser against a
 * pre-built index). Keep this free of node:fs / node:path so it can run in both.
 */

import type { SearchResult, SpecMeta } from './types.js';

/**
 * A single entry of the search index: a spec's searchable fields plus its body.
 * The body is the MDX content with the front-matter stripped.
 */
export interface SearchIndexEntry {
  id: string;
  title: string;
  category: string;
  slug: string;
  description?: string;
  /** The entire front-matter (searched as JSON text) */
  data: Record<string, unknown>;
  /** MDX body (front-matter stripped) */
  body: string;
}

const FIELD_RANK: Record<SearchResult['field'], number> = {
  title: 0,
  description: 1,
  data: 2,
  body: 3,
};

const SNIPPET_CONTEXT = 40;

/**
 * Generate a snippet with ~40 characters of context around the query match.
 * Returned as a single line with whitespace normalised.
 */
function makeSnippet(text: string, query: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  const lowerQ = query.toLowerCase();
  const idx = lower.indexOf(lowerQ);
  if (idx === -1) return normalized.slice(0, SNIPPET_CONTEXT * 2);

  const start = Math.max(0, idx - SNIPPET_CONTEXT);
  const end = Math.min(normalized.length, idx + lowerQ.length + SNIPPET_CONTEXT);

  const prefix = start > 0 ? '…' : '';
  const suffix = end < normalized.length ? '…' : '';
  return prefix + normalized.slice(start, end) + suffix;
}

/**
 * Return the first non-empty line of the body (used as a snippet fallback on title matches).
 */
function firstBodyLine(body: string): string {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed.slice(0, SNIPPET_CONTEXT * 2);
  }
  return '';
}

/** Build a SearchIndexEntry from a SpecMeta and its body text. */
export function toSearchEntry(meta: SpecMeta, body: string): SearchIndexEntry {
  return {
    id: meta.id,
    title: meta.title,
    category: meta.category,
    slug: meta.slug,
    description: meta.description,
    data: meta.data,
    body,
  };
}

/**
 * Full-text search across pre-built entries and return results.
 * Field priority: title > description > data (front-matter JSON) > body.
 * The caller is responsible for excluding _template entries from the index.
 *
 * @param entries - Pre-built search index entries
 * @param q       - Search query (returns [] when empty)
 * @param limit   - Maximum number of results (caller is expected to clamp this value)
 */
export function searchIndex(
  entries: SearchIndexEntry[],
  q: string,
  limit: number,
): SearchResult[] {
  if (!q) return [];

  const lowerQ = q.toLowerCase();
  const results: SearchResult[] = [];

  for (const entry of entries) {
    // --- title match ---
    if (entry.title.toLowerCase().includes(lowerQ)) {
      const snippet = entry.description
        ? makeSnippet(entry.description, q)
        : firstBodyLine(entry.body) || entry.title;
      results.push({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        slug: entry.slug,
        snippet,
        field: 'title',
      });
      continue;
    }

    // --- description match ---
    if (entry.description && entry.description.toLowerCase().includes(lowerQ)) {
      results.push({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        slug: entry.slug,
        snippet: makeSnippet(entry.description, q),
        field: 'description',
      });
      continue;
    }

    // --- front-matter data match ---
    const dataStr = JSON.stringify(entry.data);
    if (dataStr.toLowerCase().includes(lowerQ)) {
      results.push({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        slug: entry.slug,
        snippet: makeSnippet(dataStr, q),
        field: 'data',
      });
      continue;
    }

    // --- body match ---
    if (entry.body.toLowerCase().includes(lowerQ)) {
      results.push({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        slug: entry.slug,
        snippet: makeSnippet(entry.body, q),
        field: 'body',
      });
    }
  }

  // Sort by field rank, then by spec ID
  results.sort((a, b) => {
    const rankDiff = FIELD_RANK[a.field] - FIELD_RANK[b.field];
    if (rankDiff !== 0) return rankDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return results.slice(0, limit);
}
