import { Router, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { UserComponentFile } from '../../shared/types.js';

function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Scan the immediate children of specs/_components/ (non-recursive) for .tsx / .jsx files
 * and return UserComponentFile[] (source included). Returns [] when the directory
 * does not exist. Shared by the live route and the static export.
 */
export async function loadUserComponents(
  specsDir: string,
): Promise<UserComponentFile[]> {
  const dir = path.join(specsDir, '_components');
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return null;
      throw err;
    });
  if (entries === null) return [];

  const files: UserComponentFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(tsx|jsx)$/.test(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const source = await fs.readFile(abs, 'utf-8');
    files.push({
      path: normalizePath(path.relative(specsDir, abs)),
      source,
    });
  }
  // Sort into stable order (by name)
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

/**
 * GET /api/components
 * Scans the immediate children of specs/_components/ (non-recursive) for .tsx / .jsx files
 * and returns UserComponentFile[]. Returns [] when the directory does not exist.
 */
export function componentsRouter(specsDir: string): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      res.json(await loadUserComponents(specsDir));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
