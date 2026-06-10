import { Router, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { loadSpecs } from '../store.js';
import type { SearchResult } from '../../shared/types.js';

const FIELD_RANK: Record<SearchResult['field'], number> = {
  title: 0,
  description: 1,
  data: 2,
  body: 3,
};

const SNIPPET_CONTEXT = 40;

/**
 * Extract ~40 chars of context around the first case-insensitive match.
 * Returns a single-line string (whitespace collapsed) with prefix/suffix "…".
 */
function makeSnippet(text: string, query: string): string {
  // Collapse all whitespace to single spaces for snippet purposes
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
 * Returns the first non-empty line of the body text.
 */
function firstBodyLine(body: string): string {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed.slice(0, SNIPPET_CONTEXT * 2);
  }
  return '';
}

export function searchRouter(specsDir: string): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const rawQ = typeof req.query['q'] === 'string' ? req.query['q'] : '';
      const q = rawQ.trim();

      if (!q) {
        res.json([] as SearchResult[]);
        return;
      }

      const rawLimit = parseInt(
        typeof req.query['limit'] === 'string' ? req.query['limit'] : '20',
        10,
      );
      const limit = isNaN(rawLimit) ? 20 : Math.min(100, Math.max(1, rawLimit));

      // Load all specs (meta only initially)
      const allSpecs = await loadSpecs(specsDir);
      // Exclude _template slugs but include _ (index pages)
      const specs = allSpecs.filter((s) => s.slug !== '_template');

      const lowerQ = q.toLowerCase();
      const results: SearchResult[] = [];

      for (const spec of specs) {
        // --- title match ---
        if (spec.title.toLowerCase().includes(lowerQ)) {
          // For title matches, use description or first body line as snippet
          let snippet = '';
          if (spec.description) {
            snippet = makeSnippet(spec.description, q);
          } else {
            // Read body for snippet
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

        // --- body match (requires file read) ---
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
          // Skip unreadable files
        }
      }

      // Sort: field rank first, then spec id
      results.sort((a, b) => {
        const rankDiff = FIELD_RANK[a.field] - FIELD_RANK[b.field];
        if (rankDiff !== 0) return rankDiff;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

      res.json(results.slice(0, limit));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
