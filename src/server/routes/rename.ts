/**
 * rename.ts — POST /api/rename (スペックリネーム) & GET /api/refs (参照元検索)
 * DESIGN.md「v5 機能設計」参照。本体ロジックは ../specOps.ts
 */

import { Router, type Request, type Response } from 'express';
import { renameSpec, findRefs, SpecOpsError } from '../specOps.js';
import type { RenameSpecRequest, RenameSpecResponse, RefsResponse } from '../../shared/types.js';

/** POST /api/rename */
export function renameRouter(specsDir: string): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const body = req.body as RenameSpecRequest;

    // リクエストバリデーション
    if (typeof body.from !== 'string' || !body.from) {
      res.status(400).json({ error: 'from は必須です' });
      return;
    }
    if (typeof body.to !== 'string' || !body.to) {
      res.status(400).json({ error: 'to は必須です' });
      return;
    }

    try {
      const result = await renameSpec(specsDir, body.from, body.to);
      const response: RenameSpecResponse = {
        meta: result.meta,
        rewrittenFiles: result.rewrittenFiles,
      };
      res.json(response);
    } catch (err) {
      if (err instanceof SpecOpsError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}

/** GET /api/refs?id=<specId> */
export function refsRouter(specsDir: string): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const id = req.query['id'];

    if (typeof id !== 'string' || !id) {
      res.status(400).json({ error: 'id クエリパラメーターは必須です' });
      return;
    }

    try {
      const refs = await findRefs(specsDir, id);
      const response: RefsResponse = { refs };
      res.json(response);
    } catch (err) {
      if (err instanceof SpecOpsError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
