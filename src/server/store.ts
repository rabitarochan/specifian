import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { WIKILINK_PATTERN, type SpecMeta } from '../shared/types.js';

function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}

function stripCodeBlocks(src: string): string {
  // Remove fenced code blocks first
  let result = src.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  result = result.replace(/`[^`]*`/g, '');
  return result;
}

function extractLinks(body: string): string[] {
  const stripped = stripCodeBlocks(body);
  const seen = new Set<string>();
  const links: string[] = [];
  const re = new RegExp(WIKILINK_PATTERN.source, WIKILINK_PATTERN.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const target = m[1].trim();
    // Must contain ':' to be valid
    if (!target.includes(':')) continue;
    if (!seen.has(target)) {
      seen.add(target);
      links.push(target);
    }
  }
  return links;
}

function buildSpecMeta(
  specsDir: string,
  absolutePath: string,
  rawContent: string,
): SpecMeta {
  const parsed = matter(rawContent);
  const relPath = normalizePath(path.relative(specsDir, absolutePath));
  // relPath like "tables/users.mdx" or "users.mdx"
  const parts = relPath.split('/');
  const filename = parts[parts.length - 1];
  const slug = filename.replace(/\.mdx?$/, '');
  const category = parts.length > 1 ? parts.slice(0, -1).join('/') : '';

  const id = category === '' ? slug : `${category}:${slug}`;

  const title = (parsed.data['title'] as string | undefined) ?? slug;
  const description = parsed.data['description'] as string | undefined;

  const links = extractLinks(parsed.content);

  return {
    id,
    category,
    slug,
    path: relPath,
    title,
    description,
    data: parsed.data as Record<string, unknown>,
    links,
    isIndex: slug === '_',
  };
}

async function scanDir(
  specsDir: string,
  dir: string,
  results: SpecMeta[],
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip _generators / _components at the top level of specsDir
      if (dir === specsDir && (entry.name === '_generators' || entry.name === '_components')) {
        continue;
      }
      await scanDir(specsDir, fullPath, results);
    } else if (
      entry.isFile() &&
      /\.mdx?$/.test(entry.name) &&
      // _guide.md is a side file (authoring guide), not a spec — read separately via guide.ts
      entry.name !== '_guide.md'
    ) {
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        results.push(buildSpecMeta(specsDir, fullPath, content));
      } catch {
        // Skip unreadable files
      }
    }
  }
}

export async function loadSpecs(specsDir: string): Promise<SpecMeta[]> {
  const results: SpecMeta[] = [];
  await scanDir(specsDir, specsDir, results);
  return results;
}

export async function loadSpec(
  specsDir: string,
  absolutePath: string,
): Promise<{ meta: SpecMeta; content: string } | null> {
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    const meta = buildSpecMeta(specsDir, absolutePath, content);
    return { meta, content };
  } catch {
    return null;
  }
}

export function resolveSpecPathAny(
  specsDir: string,
  category: string,
  slug: string,
): string[] {
  const parts = category === '' ? [] : category.split('/');
  return [
    path.join(specsDir, ...parts, `${slug}.mdx`),
    path.join(specsDir, ...parts, `${slug}.md`),
  ];
}

export function guardPath(specsDir: string, target: string): boolean {
  const resolved = path.resolve(target);
  const base = path.resolve(specsDir);
  return resolved.startsWith(base + path.sep) || resolved === base;
}
