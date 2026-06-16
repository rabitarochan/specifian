/**
 * MDX runtime compilation.
 *
 * Scope injection is done via source transformation (hand-crafting estree nodes is fragile):
 * `export const specs = JSON.parse("...")` / `export const category = "..."` /
 * `export const slug = "..."` are inserted immediately after the closing `---` of the
 * front-matter block (or at the top if there is no front-matter).
 * `export const data = {};` is added only when there is no front-matter
 * (remark-mdx-frontmatter generates `data` when front-matter is present, so we must not duplicate it).
 *
 * Additionally, `export const title = ...` is injected for convenience.
 * remark-mdx-frontmatter with `name: 'data'` does not individually export top-level keys,
 * so this derives title from `data` to make `{title}` usable as a bare identifier.
 * (Injection is placed immediately after the front-matter / data declaration so it comes after `data`.)
 */
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import type { ComponentType } from 'react';
import type { SpecMeta } from '@shared/types';
import { remarkWikiLink } from './remarkWikiLink';

export interface MdxScope {
  specs: SpecMeta[];
  category: string;
  slug: string;
}

export interface CompiledMdx {
  /** Renderable component (accepts props.components). */
  Content: ComponentType<{ components?: Record<string, unknown> }>;
}

/** Returns the index just after the closing `---` line of the leading YAML front-matter block. Returns -1 if absent. */
function frontmatterEnd(source: string): number {
  // Only treat as front-matter if the source begins with `---\n` (or `---\r\n`)
  const opener = /^---[ \t]*\r?\n/.exec(source);
  if (!opener || opener.index !== 0) return -1;
  // Find the closing `---` line
  const closer = /\r?\n---[ \t]*(\r?\n|$)/.exec(source.slice(opener[0].length));
  if (!closer) return -1;
  return opener[0].length + closer.index + closer[0].length;
}

function injectScope(source: string, scope: MdxScope): string {
  const fmEnd = frontmatterEnd(source);
  const hasFrontmatter = fmEnd >= 0;

  // Double JSON.stringify to produce a JS string literal (safely escapes quotes and newlines)
  const specsLiteral = JSON.stringify(JSON.stringify(scope.specs));
  const lines = [
    `export const specs = JSON.parse(${specsLiteral});`,
    `export const category = ${JSON.stringify(scope.category)};`,
    `export const slug = ${JSON.stringify(scope.slug)};`,
  ];
  if (!hasFrontmatter) {
    // Only add data when there is no front-matter
    lines.push('export const data = {};');
  }
  // Derive title from data (so {title} can be used as a bare identifier).
  // Fall back to slug.
  lines.push(
    `export const title = (data && data.title != null) ? data.title : ${JSON.stringify(scope.slug)};`,
  );
  const block = `\n${lines.join('\n')}\n`;

  if (hasFrontmatter) {
    return source.slice(0, fmEnd) + block + source.slice(fmEnd);
  }
  return block + source;
}

export async function compileMdx(
  content: string,
  scope: MdxScope,
): Promise<CompiledMdx> {
  const source = injectScope(content, scope);
  const mod = await evaluate(source, {
    ...runtime,
    remarkPlugins: [
      remarkGfm,
      remarkFrontmatter,
      [remarkMdxFrontmatter, { name: 'data' }],
      remarkWikiLink,
    ],
  });
  return {
    Content: mod.default as ComponentType<{ components?: Record<string, unknown> }>,
  };
}
