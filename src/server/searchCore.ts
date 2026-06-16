/**
 * Full-text search core — shared by GET /api/search and the MCP search tool.
 * Logic extracted from routes/search.ts; the route becomes a thin wrapper.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { loadSpecs } from './store.js';
import type { SearchResult } from '../shared/types.js';

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

/**
 * Full-text search across specs and return results.
 * Field priority: title > description > data (front-matter JSON) > body.
 * _template is excluded; _ (index) is included.
 *
 * @param specsDir - Absolute path to the specs directory
 * @param q        - Search query (returns [] when empty)
 * @param limit    - Maximum number of results (caller is expected to clamp this value)
 */
export async function searchSpecs(
  specsDir: string,
  q: string,
  limit: number,
): Promise<SearchResult[]> {
  if (!q) return [];

  const allSpecs = await loadSpecs(specsDir);
  // Exclude _template; include _ index entries
  const specs = allSpecs.filter((s) => s.slug !== '_template');

  const lowerQ = q.toLowerCase();
  const results: SearchResult[] = [];

  for (const spec of specs) {
    // --- title match ---
    if (spec.title.toLowerCase().includes(lowerQ)) {
      let snippet = '';
      if (spec.description) {
        snippet = makeSnippet(spec.description, q);
      } else {
        const absPath = path.join(specsDir, ...spec.path.split('/'));
        try {
          const raw = await fs.readFile(absPath, 'utf-8');
          const parsed = matter(raw);
          snippet = firstBodyLine(parsed.content);
        } catch {
          snippet = spec.title;
        }
      }
      results.push({
        id: spec.id,
        title: spec.title,
        category: spec.category,
        slug: spec.slug,
        snippet,
        field: 'title',
      });
      continue;
    }

    // --- description match ---
    if (spec.description && spec.description.toLowerCase().includes(lowerQ)) {
      results.push({
        id: spec.id,
        title: spec.title,
        category: spec.category,
        slug: spec.slug,
        snippet: makeSnippet(spec.description, q),
        field: 'description',
      });
      continue;
    }

    // --- front-matter data match ---
    const dataStr = JSON.stringify(spec.data);
    if (dataStr.toLowerCase().includes(lowerQ)) {
      results.push({
        id: spec.id,
        title: spec.title,
        category: spec.category,
        slug: spec.slug,
        snippet: makeSnippet(dataStr, q),
        field: 'data',
      });
      continue;
    }

    // --- body match (requires reading the file) ---
    const absPath = path.join(specsDir, ...spec.path.split('/'));
    try {
      const raw = await fs.readFile(absPath, 'utf-8');
      const parsed = matter(raw);
      const body = parsed.content;
      if (body.toLowerCase().includes(lowerQ)) {
        results.push({
          id: spec.id,
          title: spec.title,
          category: spec.category,
          slug: spec.slug,
          snippet: makeSnippet(body, q),
          field: 'body',
        });
      }
    } catch {
      // Skip files that cannot be read
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
