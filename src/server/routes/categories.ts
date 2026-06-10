import { Router, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { guardPath } from '../store.js';
import type { CreateCategoryRequest } from '../../shared/types.js';

const DEFAULT_INDEX_CONTENT = (categoryPath: string) =>
  `---
title: ${categoryPath}
---

# ${categoryPath}

<SpecList />
`;

const DEFAULT_TEMPLATE_CONTENT = (categoryPath: string) =>
  `---
title: 新しいスペック
description: ''
---

# 新しいスペック

スペックの説明をここに記述します。
`;

export function categoriesRouter(specsDir: string): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as CreateCategoryRequest;
    if (!body.path) {
      res.status(400).json({ error: 'path は必須です' });
      return;
    }

    const categoryPath = body.path.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
    const parts = categoryPath.split('/');
    const newDir = path.join(specsDir, ...parts);

    if (!guardPath(specsDir, newDir)) {
      res.status(400).json({ error: 'パストラバーサルが検出されました' });
      return;
    }

    // Check existence
    try {
      await fs.access(newDir);
      res.status(409).json({ error: `カテゴリー "${categoryPath}" は既に存在します` });
      return;
    } catch {
      // Expected: directory does not exist
    }

    try {
      await fs.mkdir(newDir, { recursive: true });

      // Create _.mdx (index)
      const indexPath = path.join(newDir, '_.mdx');
      await fs.writeFile(indexPath, DEFAULT_INDEX_CONTENT(categoryPath), 'utf-8');

      // Create _template.mdx
      const templatePath = path.join(newDir, '_template.mdx');
      await fs.writeFile(templatePath, DEFAULT_TEMPLATE_CONTENT(categoryPath), 'utf-8');

      res.status(201).json({ path: categoryPath });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
