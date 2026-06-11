/**
 * GET /api/search?q=<query>&limit=<n=20>
 * クエリー解析・クランプはここで行い、検索ロジックは searchCore に委譲する。
 */

import { Router, type Request, type Response } from 'express';
import type { SearchResult } from '../../shared/types.js';
import { searchSpecs } from '../searchCore.js';

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

      const results = await searchSpecs(specsDir, q, limit);
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
