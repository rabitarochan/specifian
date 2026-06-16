import { Router, type Request, type Response } from 'express';
import { loadSpecs } from '../store.js';
import { listGenerators, runGenerator } from '../generate.js';
import type { GenerateRequest } from '../../shared/types.js';

export function generatorsRouter(specsDir: string): Router {
  const router = Router();

  // GET /api/generators
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const names = await listGenerators(specsDir);
      res.json(names);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}

export function generateRouter(specsDir: string): Router {
  const router = Router();

  // POST /api/generate
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as GenerateRequest;
    if (!body.generator) {
      res.status(400).json({ error: 'generator is required' });
      return;
    }

    try {
      const allSpecs = await loadSpecs(specsDir);
      const files = await runGenerator(
        specsDir,
        body.generator,
        allSpecs,
        body.specId,
        body.out,
      );
      res.json({ files });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  return router;
}
