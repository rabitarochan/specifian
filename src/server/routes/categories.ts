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
title: New Spec
description: ''
---

# New Spec

Describe the spec here.
`;

const DEFAULT_GUIDE_CONTENT = (categoryPath: string) =>
  `---
title: ${categoryPath} — Authoring Guide
description: What to record in a ${categoryPath} spec and the conventions to follow
---

## Purpose

Describe what kind of document this category holds and when to add one.

## What to record

List the information every spec in this category should capture
(complements \`_schema.json\`, which enforces the front-matter structure).

## Design conventions

Capture naming rules, design decisions, and do/don't guidance for this category.

## Examples

Link to exemplary specs with wiki links, e.g. \`[[${categoryPath}:_]]\`.
`;

export function categoriesRouter(specsDir: string): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as CreateCategoryRequest;
    if (!body.path) {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    const categoryPath = body.path.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
    const parts = categoryPath.split('/');
    const newDir = path.join(specsDir, ...parts);

    if (!guardPath(specsDir, newDir)) {
      res.status(400).json({ error: 'Path traversal detected' });
      return;
    }

    // Check existence
    try {
      await fs.access(newDir);
      res.status(409).json({ error: `Category "${categoryPath}" already exists` });
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

      // Create _guide.md (authoring guide)
      const guidePath = path.join(newDir, '_guide.md');
      await fs.writeFile(guidePath, DEFAULT_GUIDE_CONTENT(categoryPath), 'utf-8');

      res.status(201).json({ path: categoryPath });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
