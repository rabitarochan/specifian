/**
 * POST /api/lint — Validate content without saving.
 * Body: LintRequest { content: string, category?: string, slug?: string }
 * Response: LintResponse { issues: LintIssue[] }
 */

import { Router, type Request, type Response } from 'express';
import type { LintRequest, LintResponse } from '../../shared/types.js';
import { lintContent } from '../lintCore.js';

export function lintRouter(specsDir: string): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = req.body as LintRequest;

      // content is required and must be a string
      if (typeof body.content !== 'string') {
        res.status(400).json({ error: 'content must be a string' });
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
