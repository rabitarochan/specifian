/**
 * specOps.ts — スペックのリネーム・削除・参照元検索。
 * routes/rename.ts と MCP サーバーの両方から利用する。
 * DESIGN.md「v5 機能設計」参照。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { loadSpecs, guardPath } from './store.js';
import { parseSpecId, toSpecId, WIKILINK_PATTERN, type SpecMeta } from '../shared/types.js';

// ─── エラークラス ──────────────────────────────────────────────────────────────

/** HTTP ステータス付きエラー。ルートハンドラーでステータスマッピングに使う */
export class SpecOpsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SpecOpsError';
  }
}

// ─── 内部ユーティリティ ────────────────────────────────────────────────────────

/**
 * パストラバーサルガードつきでスペックの絶対パスを返す。
 * specsDir 外を指す場合は SpecOpsError(400) を投げる。
 */
function resolveSpecPath(specsDir: string, category: string, slug: string): string {
  const parts = category === '' ? [] : category.split('/');
  const filePath = path.join(specsDir, ...parts, `${slug}.mdx`);
  if (!guardPath(specsDir, filePath)) {
    throw new SpecOpsError(400, 'パストラバーサルは許可されていません');
  }
  return filePath;
}

// ─── フェンス・インラインコード除外ロジック ──────────────────────────────────

/**
 * ソース文字列中の「書き換え禁止範囲」を [start, end) のペア配列で返す。
 * - フェンスコードブロック (``` または ~~~)
 * - インラインコード (`...`)
 * 内の位置は wiki リンク置換から除外される。
 */
function buildProtectedRanges(src: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  // フェンスコードブロック: ``` または ~~~ で始まる行から終わる行まで
  // バックティックフェンス (``` 3+ 個)
  const fenceRe = /(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(src)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }

  // インラインコード (`...`) — ただしフェンス内の ` はすでにフェンス範囲でカバー済み
  // シングルバックティックのインラインコードを抽出 (フェンスとは重複しても後でチェック)
  const inlineRe = /`[^`\n]*`/g;
  while ((m = inlineRe.exec(src)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }

  // ソート & マージは不要 (isProtected で個別チェック)
  return ranges;
}

/** 位置 pos が保護範囲内かどうか判定 */
function isProtected(pos: number, ranges: Array<[number, number]>): boolean {
  for (const [s, e] of ranges) {
    if (pos >= s && pos < e) return true;
  }
  return false;
}

/**
 * src 中の wiki リンクで target が `from` と一致するものを `to` へ書き換える。
 * フェンスコードブロック・インラインコード内は変更しない。
 * 行末コードを正規化しない (バイト列をそのまま保持)。
 */
function rewriteLinks(src: string, from: string, to: string): string {
  if (!src.includes(`[[${from}]]`) && !src.includes(`[[${from}|`)) {
    // 早期脱出: 対象なし
    return src;
  }

  const protected_ = buildProtectedRanges(src);
  const re = new RegExp(WIKILINK_PATTERN.source, WIKILINK_PATTERN.flags);

  // 結果を部分文字列の結合で構築 (splice 方式でメモリを抑える)
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(src)) !== null) {
    const target = match[1]!.trim();
    if (target !== from) continue;
    if (isProtected(match.index, protected_)) continue;

    // マッチ前のテキストをそのまま追加
    result += src.slice(lastIndex, match.index);

    // リンクを書き換え
    const label = match[2]; // undefined = ラベルなし
    if (label !== undefined) {
      result += `[[${to}|${label}]]`;
    } else {
      result += `[[${to}]]`;
    }

    lastIndex = match.index + match[0].length;
  }

  result += src.slice(lastIndex);
  return result;
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * findRefs — id を wiki リンクで参照しているスペック ID 一覧を返す (ソート済み)。
 * id 自身は除外する。
 */
export async function findRefs(specsDir: string, id: string): Promise<string[]> {
  const specs = await loadSpecs(specsDir);
  const refs = specs
    .filter((s) => s.id !== id && s.links.includes(id))
    .map((s) => s.id)
    .sort();
  return refs;
}

/**
 * renameSpec — スペックのファイル名変更 + 全スペックの wiki リンク一括書き換え。
 *
 * バリデーション:
 *   - from / to どちらも parseSpecId で valid な ID でなければ 400
 *   - slug が "_" または "_template" は 400 (インデックス/テンプレートはリネーム不可)
 *   - from が loadSpecs に存在しなければ 404
 *   - to が既に存在すれば 409
 *   - to のカテゴリーディレクトリーが存在しなければ 400 (mkdir しない)
 *   - パストラバーサル 400
 *
 * 書き換え:
 *   - フェンスコードブロック・インラインコード内の wiki リンクは変更しない
 *   - ファイルの行末を正規化しない
 *
 * @returns 新しい SpecMeta と、実際に wiki リンクが書き換わったスペック ID 一覧 (ソート済み)
 */
export async function renameSpec(
  specsDir: string,
  from: string,
  to: string,
): Promise<{ meta: SpecMeta; rewrittenFiles: string[] }> {
  // ── ID バリデーション ───────────────────────────────────────────────
  const parsedFrom = parseSpecId(from);
  if (!parsedFrom) {
    throw new SpecOpsError(400, `無効なスペック ID: ${from}`);
  }
  const parsedTo = parseSpecId(to);
  if (!parsedTo) {
    throw new SpecOpsError(400, `無効なスペック ID: ${to}`);
  }

  // インデックス / テンプレートは slug ベースで禁止
  if (parsedFrom.slug === '_' || parsedFrom.slug === '_template') {
    throw new SpecOpsError(400, 'インデックス/テンプレートはリネームできません');
  }
  if (parsedTo.slug === '_' || parsedTo.slug === '_template') {
    throw new SpecOpsError(400, 'リネーム先の slug にインデックス/テンプレートは使用できません');
  }

  // ── ファイルパス解決 & パストラバーサルガード ──────────────────────
  const fromPath = resolveSpecPath(specsDir, parsedFrom.category, parsedFrom.slug);
  const toPath = resolveSpecPath(specsDir, parsedTo.category, parsedTo.slug);

  // ── from の存在確認 ─────────────────────────────────────────────────
  const specs = await loadSpecs(specsDir);
  const fromMeta = specs.find((s) => s.id === from);
  if (!fromMeta) {
    throw new SpecOpsError(404, `スペックが見つかりません: ${from}`);
  }

  // ── to の非存在確認 ─────────────────────────────────────────────────
  const toExists = specs.some((s) => s.id === to);
  if (toExists) {
    throw new SpecOpsError(409, `リネーム先は既に存在します: ${to}`);
  }

  // ── to のカテゴリーディレクトリー存在確認 ─────────────────────────
  const toCategoryDir = path.dirname(toPath);
  try {
    await fs.access(toCategoryDir);
  } catch {
    const relCategoryDir = path.relative(specsDir, toCategoryDir).split(path.sep).join('/');
    throw new SpecOpsError(400, `リネーム先のカテゴリーディレクトリーが存在しません: ${relCategoryDir}`);
  }

  // ── ファイルリネーム ────────────────────────────────────────────────
  await fs.rename(fromPath, toPath);

  // ── 全スペック (リネーム後のパス込み) の wiki リンク書き換え ───────
  // リネーム後に再ロードして最新のファイル一覧を取得
  const specsAfter = await loadSpecs(specsDir);
  const rewrittenIds: string[] = [];

  await Promise.all(
    specsAfter.map(async (spec) => {
      // リネーム後のスペックが to として含まれることに注意 (自己リンクも書き換え対象)
      const parts = spec.category === '' ? [] : spec.category.split('/');
      const filePath = path.join(specsDir, ...parts, `${spec.slug}.mdx`);

      let content: string;
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch {
        return;
      }

      const rewritten = rewriteLinks(content, from, to);
      if (rewritten === content) return;

      await fs.writeFile(filePath, rewritten, 'utf-8');
      rewrittenIds.push(spec.id);
    }),
  );

  rewrittenIds.sort();

  // ── リネーム後の meta を取得 ────────────────────────────────────────
  const { loadSpec } = await import('./store.js');
  const result = await loadSpec(specsDir, toPath);
  if (!result) {
    throw new SpecOpsError(500, 'リネーム後のスペック読み込みに失敗しました');
  }

  return { meta: result.meta, rewrittenFiles: rewrittenIds };
}

/**
 * deleteSpec — スペックファイルを削除する。
 *
 * バリデーション:
 *   - id が parseSpecId で valid でなければ 400
 *   - id が loadSpecs に存在しなければ 404 (_template も削除可)
 *   - パストラバーサル 400
 */
export async function deleteSpec(specsDir: string, id: string): Promise<void> {
  const parsed = parseSpecId(id);
  if (!parsed) {
    throw new SpecOpsError(400, `無効なスペック ID: ${id}`);
  }

  const filePath = resolveSpecPath(specsDir, parsed.category, parsed.slug);

  // 存在確認 (loadSpecs を使う — _template も検出できる)
  const specs = await loadSpecs(specsDir);
  const exists = specs.some((s) => s.id === id);
  if (!exists) {
    throw new SpecOpsError(404, `スペックが見つかりません: ${id}`);
  }

  await fs.unlink(filePath);
}
