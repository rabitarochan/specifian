/**
 * POST /api/lint — 保存せずにコンテンツを検証する。
 * ボディ: LintRequest { content: string, category?: string, slug?: string }
 * レスポンス: LintResponse { issues: LintIssue[] }
 */

import { Router, type Request, type Response } from 'express';
import type { LintRequest, LintResponse } from '../../shared/types.js';
import { lintContent } from '../lintCore.js';

export function lintRouter(specsDir: string): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = req.body as LintRequest;

      // content は必須かつ string であること
      if (typeof body.content !== 'string') {
        res.status(400).json({ error: 'content は string である必要があります' });
        return;
      }

      const issues = await lintContent(specsDir, {
        content: body.content,
        category: typeof body.category === 'string' ? body.category : undefined,
        slug: typeof body.slug === 'string' ? body.slug : undefined,
      });

      res.json({ issues } as LintResponse);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
