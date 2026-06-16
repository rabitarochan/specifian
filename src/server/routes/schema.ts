import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { loadCategorySchema } from '../validate.js';
import type { CategorySchemaResponse } from '../../shared/types.js';

/**
 * GET /api/schema/<categoryPath>
 * categoryPath can be nested (e.g. "tables", "api/v1", "").
 * Returns { schema: null } when _schema.json does not exist (no 404).
 * Path-traversal guard: returns 400 if the resolved path is outside specsDir.
 */
export function schemaRouter(specsDir: string): Router {
  const router = Router();

  router.get(/^(\/.*)?$/, async (req: Request, res: Response): Promise<void> => {
    // Extract the category path from the URL (strip leading slash)
    const rawPath = req.path;
    // Decode URI components (e.g. %2F in category names — though categories use plain slashes)
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch {
      res.status(400).json({ error: 'Failed to decode URL' });
      return;
    }

    // Strip leading slash → category string ("" or "tables" or "api/v1")
    const category = decoded.replace(/^\//, '');

    // Path-traversal guard: resolve the target directory and ensure it is inside specsDir
    const resolvedSpecsDir = path.resolve(specsDir);
    const segments = category === '' ? [] : category.split('/');
    const resolvedTarget = path.resolve(specsDir, ...segments);

    if (!resolvedTarget.startsWith(resolvedSpecsDir + path.sep) && resolvedTarget !== resolvedSpecsDir) {
      res.status(400).json({ error: 'Path traversal is not allowed' });
      return;
    }

    const result = await loadCategorySchema(specsDir, category);

    if (result.error !== undefined) {
      // Unreadable or invalid JSON
      res.status(500).json({ error: result.error });
      return;
    }

    const body: CategorySchemaResponse = { schema: result.schema };
    res.json(body);
  });

  return router;
}
