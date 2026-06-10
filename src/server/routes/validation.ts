import { Router, type Request, type Response } from 'express';
import { validateSpecs } from '../validate.js';

export function validationRouter(specsDir: string): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const report = await validateSpecs(specsDir);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
