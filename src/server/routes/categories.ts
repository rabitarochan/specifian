import { Router, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { guardPath, loadSpec, resolveSpecPathAny } from '../store.js';
import type {
  CreateCategoryRequest,
  SaveCategorySettingsRequest,
} from '../../shared/types.js';

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

  // Resolve the category path from the request URL ("" = root), with a path-traversal
  // guard. Mirrors routes/guide.ts.
  function resolveCategory(req: Request, res: Response): string | null {
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      res.status(400).json({ error: 'Failed to decode URL' });
      return null;
    }
    const category = decoded.replace(/^\//, '').replace(/\/$/, '');
    const segments = category === '' ? [] : category.split('/');
    const target = path.join(specsDir, ...segments);
    if (!guardPath(specsDir, target)) {
      res.status(400).json({ error: 'Path traversal is not allowed' });
      return null;
    }
    return category;
  }

  // PUT /api/categories/<category> — merge name/icon/color into the category index
  // (_.mdx) front-matter. Creates _.mdx from the default template when absent.
  router.put(/^(\/.*)?$/, async (req: Request, res: Response): Promise<void> => {
    const category = resolveCategory(req, res);
    if (category === null) return;

    const body = (req.body ?? {}) as SaveCategorySettingsRequest;

    // Locate the index file (_.mdx preferred, then _.md).
    const candidates = resolveSpecPathAny(specsDir, category, '_');
    let target: string | null = null;
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        target = candidate;
        break;
      } catch {
        // keep looking
      }
    }

    let raw: string;
    if (target === null) {
      // No index yet — create _.mdx from the default template.
      target = candidates[0];
      raw = DEFAULT_INDEX_CONTENT(category);
      try {
        await fs.mkdir(path.dirname(target), { recursive: true });
      } catch (err) {
        res.status(500).json({ error: String(err) });
        return;
      }
    } else {
      try {
        raw = await fs.readFile(target, 'utf-8');
      } catch (err) {
        res.status(500).json({ error: String(err) });
        return;
      }
    }

    // Merge icon / color into the front-matter (null / '' clears the key).
    let content: string;
    let data: Record<string, unknown>;
    try {
      const parsed = matter(raw);
      content = parsed.content;
      data = parsed.data as Record<string, unknown>;
    } catch (err) {
      res.status(400).json({ error: `Failed to parse front-matter: ${String(err)}` });
      return;
    }
    const apply = (
      key: 'name' | 'icon' | 'color',
      value: string | null | undefined,
    ): void => {
      if (value === undefined) return; // not provided → leave as-is
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (trimmed === '') delete data[key];
      else data[key] = trimmed;
    };
    apply('name', body.name);
    apply('icon', body.icon);
    apply('color', body.color);

    try {
      await fs.writeFile(target, matter.stringify(content, data), 'utf-8');
    } catch (err) {
      res.status(500).json({ error: String(err) });
      return;
    }

    const saved = await loadSpec(specsDir, target);
    if (!saved) {
      res.status(500).json({ error: 'Failed to reload category index after save' });
      return;
    }
    res.json(saved.meta);
  });

  return router;
}
