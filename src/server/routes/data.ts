import { Router, type Request, type Response } from 'express';
import { loadSpecs } from '../store.js';
import type { AllData } from '../../shared/types.js';

export function dataRouter(specsDir: string): Router {
  const router = Router();

  // GET /api/data — all front-matter data (excluding _template)
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const specs = await loadSpecs(specsDir);
      const filtered = specs.filter((s) => s.slug !== '_template');
      const result: AllData = {};
      for (const spec of filtered) {
        const cat = spec.category;
        if (!result[cat]) result[cat] = {};
        result[cat][spec.slug] = spec.data;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/data/* — data for a category (root category captures as empty)
  // Express 5 (path-to-regexp v8) drops the bare '/*' string wildcard; use a
  // regex route so the captured splat stays available as req.params[0].
  router.get(/^\/(.*)$/, async (req: Request, res: Response) => {
    const categoryPath = ((req.params as Record<string, string>)[0] ?? '')
      .split('/')
      .filter(Boolean)
      .join('/');

    try {
      const specs = await loadSpecs(specsDir);
      const filtered = specs.filter(
        (s) => s.category === categoryPath && s.slug !== '_template',
      );
      const result: Record<string, Record<string, unknown>> = {};
      for (const spec of filtered) {
        result[spec.slug] = spec.data;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
