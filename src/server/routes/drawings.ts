import path from 'node:path';
import fs from 'node:fs/promises';
import { Router, json, type Request, type Response } from 'express';
import type { DrawingMeta } from '../../shared/types.js';

function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Path traversal guard.
 * Resolves a decoded path string under specsDir and returns null
 * if it points outside specsDir.
 */
function resolveGuarded(specsDir: string, relPath: string): string | null {
  const resolvedSpecsDir = path.resolve(specsDir);
  const resolvedTarget = path.resolve(specsDir, ...relPath.split('/'));
  if (
    resolvedTarget !== resolvedSpecsDir &&
    !resolvedTarget.startsWith(resolvedSpecsDir + path.sep)
  ) {
    return null;
  }
  return resolvedTarget;
}

/**
 * Recursively scan specsDir for *.excalidraw files.
 * Dot-directories (e.g. .git) and node_modules are excluded.
 */
export async function scanExcalidraw(specsDir: string, dir: string): Promise<DrawingMeta[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: DrawingMeta[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const children = await scanExcalidraw(specsDir, abs);
      results.push(...children);
    } else if (entry.isFile() && entry.name.endsWith('.excalidraw')) {
      results.push({
        path: normalizePath(path.relative(specsDir, abs)),
      });
    }
  }
  return results;
}

/**
 * /api/drawings router
 *
 * GET /               → DrawingMeta[] (all .excalidraw files under specsDir, paths relative to specsDir with "/" separators)
 * GET /<path>         → scene JSON (404 if missing); <path> is without extension
 * PUT /<path>         → save body as scene JSON (new files allowed; parent directory must exist)
 *
 * express.json({ limit: '20mb' }) is applied at router level.
 * Excalidraw scenes can be large, so this overrides the app-wide 100 kb limit.
 */
export function drawingsRouter(specsDir: string): Router {
  const router = Router();

  // Override body-limit at router level (scene JSON can be large)
  router.use(json({ limit: '20mb' }));

  // ─── GET / (list) ────────────────────────────────────────────────
  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
      const drawings = await scanExcalidraw(specsDir, specsDir);
      // Sort into stable alphabetical order
      drawings.sort((a, b) => a.path.localeCompare(b.path));
      res.json(drawings);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── GET /<path> (single item) ───────────────────────────────────
  router.get(/^\/.+$/, async (req: Request, res: Response): Promise<void> => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      res.status(400).json({ error: 'Failed to decode URL' });
      return;
    }

    // Strip leading slash
    const relPath = decoded.replace(/^\//, '');

    if (!relPath) {
      res.status(400).json({ error: 'Path is empty' });
      return;
    }

    // Path traversal guard
    const resolved = resolveGuarded(specsDir, relPath);
    if (resolved === null) {
      res.status(400).json({ error: 'Path traversal is not allowed' });
      return;
    }

    const filePath = resolved + '.excalidraw';

    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        res.status(404).json({ error: 'Drawing not found' });
        return;
      }
      res.status(500).json({ error: String(err) });
      return;
    }

    res.type('application/json').send(raw);
  });

  // ─── PUT /<path> (save) ──────────────────────────────────────────
  router.put(/^\/.+$/, async (req: Request, res: Response): Promise<void> => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      res.status(400).json({ error: 'Failed to decode URL' });
      return;
    }

    // Strip leading slash
    const relPath = decoded.replace(/^\//, '');

    if (!relPath) {
      res.status(400).json({ error: 'Path is empty' });
      return;
    }

    // Path traversal guard
    const resolved = resolveGuarded(specsDir, relPath);
    if (resolved === null) {
      res.status(400).json({ error: 'Path traversal is not allowed' });
      return;
    }

    // Body validation: must be a non-null object
    const body = req.body as unknown;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    const filePath = resolved + '.excalidraw';

    // Verify parent directory exists (we do not mkdir — drawings live next to specs)
    const parentDir = path.dirname(filePath);
    try {
      await fs.access(parentDir);
    } catch {
      res.status(400).json({ error: `Parent directory does not exist: ${normalizePath(path.relative(specsDir, parentDir))}` });
      return;
    }

    try {
      const content = JSON.stringify(body, null, 2) + '\n';
      await fs.writeFile(filePath, content, { encoding: 'utf-8' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
      return;
    }

    const meta: DrawingMeta = {
      path: normalizePath(path.relative(specsDir, filePath)),
    };
    res.json(meta);
  });

  return router;
}
