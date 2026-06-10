import { Router, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import {
  loadSpecs,
  loadSpec,
  resolveSpecPathAny,
  guardPath,
} from '../store.js';
import type {
  CreateSpecRequest,
  SaveSpecRequest,
} from '../../shared/types.js';

export function specsRouter(specsDir: string): Router {
  const router = Router();

  // GET /api/specs — list all (excluding _template)
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const specs = await loadSpecs(specsDir);
      const filtered = specs.filter((s) => s.slug !== '_template');
      res.json(filtered);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/specs — create new spec
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as CreateSpecRequest;
    if (!body.slug) {
      res.status(400).json({ error: 'slug は必須です' });
      return;
    }

    const category = body.category ?? '';
    const slug = body.slug;
    const title = body.title ?? slug;

    // Guard path
    const categoryParts = category === '' ? [] : category.split('/');
    const newFilePath = path.join(specsDir, ...categoryParts, `${slug}.mdx`);

    if (!guardPath(specsDir, newFilePath)) {
      res.status(400).json({ error: 'パストラバーサルが検出されました' });
      return;
    }

    // Check existence
    try {
      await fs.access(newFilePath);
      res.status(409).json({ error: `"${slug}" は既に存在します` });
      return;
    } catch {
      // Expected: file does not exist
    }

    // Try to use template
    let content: string;
    const templatePath = path.join(specsDir, ...categoryParts, '_template.mdx');
    try {
      await fs.access(templatePath);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const parsed = matter(templateContent);
      parsed.data['title'] = title;
      content = matter.stringify(parsed.content, parsed.data);
    } catch {
      content = `---\ntitle: ${title}\n---\n\n# ${title}\n`;
    }

    try {
      await fs.mkdir(path.dirname(newFilePath), { recursive: true });
      await fs.writeFile(newFilePath, content, 'utf-8');
      const result = await loadSpec(specsDir, newFilePath);
      if (!result) {
        res.status(500).json({ error: '作成後の読み込みに失敗しました' });
        return;
      }
      res.status(201).json({ meta: result.meta });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/specs/* — get single spec
  router.get('/*', async (req: Request, res: Response) => {
    const paramPath = (req.params as Record<string, string>)[0] ?? '';
    if (!paramPath) {
      res.status(400).json({ error: 'パスが指定されていません' });
      return;
    }

    const segments = paramPath.split('/').filter(Boolean);
    if (segments.length === 0) {
      res.status(400).json({ error: 'パスが指定されていません' });
      return;
    }

    const slug = segments[segments.length - 1];
    const category = segments.length > 1 ? segments.slice(0, -1).join('/') : '';

    const candidates = resolveSpecPathAny(specsDir, category, slug);

    for (const candidate of candidates) {
      if (!guardPath(specsDir, candidate)) {
        res.status(400).json({ error: 'パストラバーサルが検出されました' });
        return;
      }
      const result = await loadSpec(specsDir, candidate);
      if (result) {
        res.json(result);
        return;
      }
    }

    res.status(404).json({ error: `スペックが見つかりません: ${paramPath}` });
  });

  // PUT /api/specs/* — save spec
  router.put('/*', async (req: Request, res: Response) => {
    const paramPath = (req.params as Record<string, string>)[0] ?? '';
    if (!paramPath) {
      res.status(400).json({ error: 'パスが指定されていません' });
      return;
    }

    const body = req.body as SaveSpecRequest;
    if (typeof body.content !== 'string') {
      res.status(400).json({ error: 'content は必須です' });
      return;
    }

    const segments = paramPath.split('/').filter(Boolean);
    if (segments.length === 0) {
      res.status(400).json({ error: 'パスが指定されていません' });
      return;
    }

    const slug = segments[segments.length - 1];
    const category = segments.length > 1 ? segments.slice(0, -1).join('/') : '';

    const candidates = resolveSpecPathAny(specsDir, category, slug);

    let foundCandidate: string | null = null;
    for (const candidate of candidates) {
      if (!guardPath(specsDir, candidate)) {
        res.status(400).json({ error: 'パストラバーサルが検出されました' });
        return;
      }
      try {
        await fs.access(candidate);
        foundCandidate = candidate;
        break;
      } catch {
        // File doesn't exist, try next candidate
      }
    }

    if (!foundCandidate) {
      res.status(404).json({ error: `スペックが見つかりません: ${paramPath}` });
      return;
    }

    try {
      await fs.writeFile(foundCandidate, body.content, 'utf-8');
      const result = await loadSpec(specsDir, foundCandidate);
      if (!result) {
        res.status(500).json({ error: '保存後の読み込みに失敗しました' });
        return;
      }
      res.json({ meta: result.meta });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
