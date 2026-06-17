/**
 * Full-text search core — shared by GET /api/search and the MCP search tool.
 * Reads spec bodies from disk to build the search index, then delegates the
 * matching/ranking to the fs-independent engine in shared/searchEngine.ts
 * (which the static export and the browser also use).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { loadSpecs } from './store.js';
import {
  searchIndex,
  toSearchEntry,
  type SearchIndexEntry,
} from '../shared/searchEngine.js';
import type { SearchResult } from '../shared/types.js';

/**
 * Build the full search index by reading every spec's body from disk.
 * _template is excluded; _ (index) entries are included.
 * Shared by the live search route and the static export.
 */
export async function buildSearchEntries(
  specsDir: string,
): Promise<SearchIndexEntry[]> {
  const allSpecs = await loadSpecs(specsDir);
  const specs = allSpecs.filter((s) => s.slug !== '_template');

  const entries: SearchIndexEntry[] = [];
  for (const spec of specs) {
    let body = '';
    try {
      const absPath = path.join(specsDir, ...spec.path.split('/'));
      const raw = await fs.readFile(absPath, 'utf-8');
      body = matter(raw).content;
    } catch {
      // Unreadable file: index metadata only
    }
    entries.push(toSearchEntry(spec, body));
  }
  return entries;
}

/**
 * Full-text search across specs and return results.
 * Field priority: title > description > data (front-matter JSON) > body.
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
  const entries = await buildSearchEntries(specsDir);
  return searchIndex(entries, q, limit);
}
