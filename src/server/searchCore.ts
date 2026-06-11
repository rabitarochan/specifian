/**
 * 全文検索コア — GET /api/search および MCP search ツールから共用する。
 * routes/search.ts のロジックをここに抽出。ルートは薄いラッパーになる。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { loadSpecs } from './store.js';
import type { SearchResult } from '../shared/types.js';

const FIELD_RANK: Record<SearchResult['field'], number> = {
  title: 0,
  description: 1,
  data: 2,
  body: 3,
};

const SNIPPET_CONTEXT = 40;

/**
 * クエリーの前後 ~40 文字のスニペットを生成する。
 * 空白を正規化した単一行として返す。
 */
function makeSnippet(text: string, query: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  const lowerQ = query.toLowerCase();
  const idx = lower.indexOf(lowerQ);
  if (idx === -1) return normalized.slice(0, SNIPPET_CONTEXT * 2);

  const start = Math.max(0, idx - SNIPPET_CONTEXT);
  const end = Math.min(normalized.length, idx + lowerQ.length + SNIPPET_CONTEXT);

  const prefix = start > 0 ? '…' : '';
  const suffix = end < normalized.length ? '…' : '';
  return prefix + normalized.slice(start, end) + suffix;
}

/**
 * 本文の最初の非空行を返す (タイトルマッチ時のスニペット代替)。
 */
function firstBodyLine(body: string): string {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed.slice(0, SNIPPET_CONTEXT * 2);
  }
  return '';
}

/**
 * スペックを全文検索して結果を返す。
 * フィールド優先順: title > description > data (front-matter JSON) > body。
 * _template は除外、_ (インデックス) は含める。
 *
 * @param specsDir - specs ディレクトリーの絶対パス
 * @param q        - 検索クエリー (空文字の場合は [] を返す)
 * @param limit    - 最大返却件数 (呼び出し元でクランプ済みを想定)
 */
export async function searchSpecs(
  specsDir: string,
  q: string,
  limit: number,
): Promise<SearchResult[]> {
  if (!q) return [];

  const allSpecs = await loadSpecs(specsDir);
  // _template 除外、_ インデックスは含める
  const specs = allSpecs.filter((s) => s.slug !== '_template');

  const lowerQ = q.toLowerCase();
  const results: SearchResult[] = [];

  for (const spec of specs) {
    // --- title マッチ ---
    if (spec.title.toLowerCase().includes(lowerQ)) {
      let snippet = '';
      if (spec.description) {
        snippet = makeSnippet(spec.description, q);
      } else {
        const absPath = path.join(specsDir, ...spec.path.split('/'));
        try {
          const raw = await fs.readFile(absPath, 'utf-8');
          const parsed = matter(raw);
          snippet = firstBodyLine(parsed.content);
        } catch {
          snippet = spec.title;
        }
      }
      results.push({
        id: spec.id,
        title: spec.title,
        category: spec.category,
        slug: spec.slug,
        snippet,
        field: 'title',
      });
      continue;
    }

    // --- description マッチ ---
    if (spec.description && spec.description.toLowerCase().includes(lowerQ)) {
      results.push({
        id: spec.id,
        title: spec.title,
        category: spec.category,
        slug: spec.slug,
        snippet: makeSnippet(spec.description, q),
        field: 'description',
      });
      continue;
    }

    // --- front-matter data マッチ ---
    const dataStr = JSON.stringify(spec.data);
    if (dataStr.toLowerCase().includes(lowerQ)) {
      results.push({
        id: spec.id,
        title: spec.title,
        category: spec.category,
        slug: spec.slug,
        snippet: makeSnippet(dataStr, q),
        field: 'data',
      });
      continue;
    }

    // --- 本文マッチ (ファイル読み込みが必要) ---
    const absPath = path.join(specsDir, ...spec.path.split('/'));
    try {
      const raw = await fs.readFile(absPath, 'utf-8');
      const parsed = matter(raw);
      const body = parsed.content;
      if (body.toLowerCase().includes(lowerQ)) {
        results.push({
          id: spec.id,
          title: spec.title,
          category: spec.category,
          slug: spec.slug,
          snippet: makeSnippet(body, q),
          field: 'body',
        });
      }
    } catch {
      // 読み込めないファイルはスキップ
    }
  }

  // フィールドランク → spec ID の順でソート
  results.sort((a, b) => {
    const rankDiff = FIELD_RANK[a.field] - FIELD_RANK[b.field];
    if (rankDiff !== 0) return rankDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return results.slice(0, limit);
}
