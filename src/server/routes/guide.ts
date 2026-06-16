import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { loadGuide, saveGuide } from '../guide.js';
import type { GuideResponse, SaveGuideRequest } from '../../shared/types.js';

/**
 * GET /api/guide/<categoryPath>  — fetch a category's _guide.md ("" = root/project-wide).
 * PUT /api/guide/<categoryPath>  — save it (body: { content: string }).
 * Returns { guide: null } when _guide.md does not exist (no 404).
 * Path-traversal guard mirrors routes/schema.ts.
 */
export function guideRouter(specsDir: string): Router {
  const router = Router();

  function resolveCategory(req: Request, res: Response): string | null {
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      res.status(400).json({ error: 'Failed to decode URL' });
      return null;
    }
    const category = decoded.replace(/^\//, '');

    const resolvedSpecsDir = path.resolve(specsDir);
    const segments = category === '' ? [] : category.split('/');
    const resolvedTarget = path.resolve(specsDir, ...segments);
    if (
      !resolvedTarget.startsWith(resolvedSpecsDir + path.sep) &&
      resolvedTarget !== resolvedSpecsDir
    ) {
      res.status(400).json({ error: 'Path traversal is not allowed' });
      return null;
    }
    return category;
  }

  router.get(/^(\/.*)?$/, async (req: Request, res: Response): Promise<void> => {
    const category = resolveCategory(req, res);
    if (category === null) return;

    const result = await loadGuide(specsDir, category);
    if (result.error !== undefined) {
      res.status(500).json({ error: result.error });
      return;
    }
    const body: GuideResponse = {
      guide: result.guide,
      title: result.title,
      description: result.description,
    };
    res.json(body);
  });

  router.put(/^(\/.*)?$/, async (req: Request, res: Response): Promise<void> => {
    const category = resolveCategory(req, res);
    if (category === null) return;

    const body = req.body as Partial<SaveGuideRequest>;
    if (typeof body?.content !== 'string') {
      res.status(400).json({ error: 'Body must be { content: string }' });
      return;
    }

    try {
      await saveGuide(specsDir, category, body.content);
    } catch (err) {
      res.status(500).json({ error: `Failed to save _guide.md: ${String(err)}` });
      return;
    }

    const result = await loadGuide(specsDir, category);
    const responseBody: GuideResponse = {
      guide: result.guide,
      title: result.title,
      description: result.description,
    };
    res.json(responseBody);
  });

  return router;
}
