/**
 * MDX ランタイムコンパイル。
 *
 * scope 注入はソース変換で行う (estree ノードの手組みは脆いため):
 * front-matter の閉じ `---` 直後 (front-matter が無ければ先頭) に
 * `export const specs = JSON.parse("...")` / `export const category = "..."` /
 * `export const slug = "..."` を挿入する。
 * front-matter が無い場合のみ `export const data = {};` も追加する
 * (front-matter がある場合は remark-mdx-frontmatter が `data` を生成するため重複させない)。
 *
 * さらに利便性のため `export const title = ...` を注入する。
 * remark-mdx-frontmatter は `name: 'data'` のとき top-level キーを個別 export しないため、
 * `data` から導出して `{title}` を裸の識別子として使えるようにする。
 * (注入位置は `data` 宣言より後ろになるよう front-matter / data 宣言の直後に置く)
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
  /** 描画可能なコンポーネント (props.components を受け取る) */
  Content: ComponentType<{ components?: Record<string, unknown> }>;
}

/** 先頭の YAML front-matter ブロックの終端 (閉じ `---` 行の次) のインデックスを返す。無ければ -1 */
function frontmatterEnd(source: string): number {
  // 先頭が `---\n` (または `---\r\n`) で始まる場合のみ front-matter とみなす
  const opener = /^---[ \t]*\r?\n/.exec(source);
  if (!opener || opener.index !== 0) return -1;
  // 閉じの `---` 行を探す
  const closer = /\r?\n---[ \t]*(\r?\n|$)/.exec(source.slice(opener[0].length));
  if (!closer) return -1;
  return opener[0].length + closer.index + closer[0].length;
}

function injectScope(source: string, scope: MdxScope): string {
  const fmEnd = frontmatterEnd(source);
  const hasFrontmatter = fmEnd >= 0;

  // JSON.stringify を二重にして JS リテラル文字列を作る (引用符・改行を安全にエスケープ)
  const specsLiteral = JSON.stringify(JSON.stringify(scope.specs));
  const lines = [
    `export const specs = JSON.parse(${specsLiteral});`,
    `export const category = ${JSON.stringify(scope.category)};`,
    `export const slug = ${JSON.stringify(scope.slug)};`,
  ];
  if (!hasFrontmatter) {
    // front-matter が無いときだけ data を補う
    lines.push('export const data = {};');
  }
  // data から title を導出 ({title} を裸の識別子として使えるように)。
  // slug をフォールバックにする。
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
