/**
 * yamlSync.ts — front-matter の split / replace ユーティリティ
 *
 * ブラウザで動作する純粋関数。Node.js の import は使わない。
 * yaml パッケージ (v2.x) の parse / stringify を使用。
 */

import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

export interface FrontMatterParts {
  data: Record<string, unknown>;
  /** front-matter ブロックを除いた本文 (先頭の改行 1 つは除去) */
  body: string;
  hasFrontMatter: boolean;
  /** YAML パース失敗時のみセット。その場合 data は {} */
  error?: string;
}

/**
 * CRLF / LF を正規化せず行単位で分割するためのヘルパー。
 * 行末の CR は保持したまま返す (CRLF コンテンツでも body の改行を変えない)。
 */
function splitLines(text: string): string[] {
  return text.split('\n');
}

/**
 * content が front-matter を持つかどうかを判定する。
 * 条件: 1行目が "---" (CRLF の場合は "---\r") であること。
 */
function startsWithFrontMatterDelimiter(content: string): boolean {
  const firstNewline = content.indexOf('\n');
  const firstLine = firstNewline === -1 ? content : content.slice(0, firstNewline);
  // 末尾の CR を除去して比較
  return firstLine.replace(/\r$/, '') === '---';
}

/**
 * front-matter ブロックの終端行 (2 番目の "---" 行) のインデックスを返す。
 * 見つからなければ -1。
 * lines[0] は "---" (または "---\r") であることが前提。
 */
function findClosingDelimiterIndex(lines: string[]): number {
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '') === '---') {
      return i;
    }
  }
  return -1;
}

/**
 * content を front-matter の YAML データと本文に分割する。
 *
 * - front-matter 検出: 最初の行が "---" のみ (CRLF 対応)
 * - 終端: 次に現れる "---" のみの行
 * - YAML パース失敗: data = {}, error にメッセージをセット
 * - YAML 結果が object でない (scalar / array / null): data = {}, error にメッセージをセット
 */
export function splitFrontMatter(content: string): FrontMatterParts {
  if (!startsWithFrontMatterDelimiter(content)) {
    return { data: {}, body: content, hasFrontMatter: false };
  }

  const lines = splitLines(content);
  const closingIdx = findClosingDelimiterIndex(lines);

  if (closingIdx === -1) {
    // "---" が閉じられていない → front-matter なし扱い
    return { data: {}, body: content, hasFrontMatter: false };
  }

  // YAML ブロック: lines[1] .. lines[closingIdx - 1]
  const yamlLines = lines.slice(1, closingIdx);
  const yamlText = yamlLines.join('\n');

  // 本文: lines[closingIdx + 1] 以降。先頭の空行 1 つを除去。
  const bodyLines = lines.slice(closingIdx + 1);
  // 先頭が空行 (または "\r") なら 1 行除去
  let body: string;
  if (bodyLines.length > 0 && bodyLines[0].replace(/\r$/, '') === '') {
    body = bodyLines.slice(1).join('\n');
  } else {
    body = bodyLines.join('\n');
  }

  let parsed: unknown;
  try {
    parsed = yamlParse(yamlText);
  } catch (err) {
    return {
      data: {},
      body,
      hasFrontMatter: true,
      error: `YAML のパースに失敗しました: ${String(err)}`,
    };
  }

  if (parsed === null || parsed === undefined) {
    // 空の YAML ブロック → 空オブジェクト扱い (エラーなし)
    return { data: {}, body, hasFrontMatter: true };
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      data: {},
      body,
      hasFrontMatter: true,
      error: `front-matter はオブジェクトである必要があります (実際の型: ${Array.isArray(parsed) ? 'array' : typeof parsed})`,
    };
  }

  return {
    data: parsed as Record<string, unknown>,
    body,
    hasFrontMatter: true,
  };
}

/**
 * content の front-matter 部分を data で置き換えて返す。
 *
 * - front-matter が存在する場合: YAML ブロックを再シリアライズして差し替える。
 *   data が空オブジェクト → `---\n---` のみのブロックに置き換える。
 * - front-matter が存在しない場合:
 *   data が空オブジェクト → content をそのまま返す (変更なし)。
 *   data に内容がある → `---\n<yaml>---\n\n` を先頭に付加する。
 *
 * 本文の行末文字は変更しない (YAML ブロックだけを再生成)。
 * YAML シリアライズは lineWidth: 0 で折り返しなし、キー順は挿入順を維持。
 */
export function replaceFrontMatter(
  content: string,
  data: Record<string, unknown>,
): string {
  const isEmpty = Object.keys(data).length === 0;

  if (!startsWithFrontMatterDelimiter(content)) {
    // front-matter なし
    if (isEmpty) {
      return content;
    }
    const yamlBlock = yamlStringify(data, { lineWidth: 0 });
    return `---\n${yamlBlock}---\n\n${content}`;
  }

  const lines = splitLines(content);
  const closingIdx = findClosingDelimiterIndex(lines);

  if (closingIdx === -1) {
    // 閉じられていない front-matter — 先頭に新しいブロックを挿入するのは混乱を招くため
    // 変更せずそのまま返す
    return content;
  }

  // 本文部分 (closingIdx + 1 以降) をそのまま保持
  const bodyLines = lines.slice(closingIdx + 1);
  const bodySuffix = bodyLines.join('\n');

  // 先頭の "---" 行の改行文字スタイルを保持 (CRLF か LF か)
  const firstLineHasCR = lines[0].endsWith('\r');
  const delim = firstLineHasCR ? '---\r' : '---';

  if (isEmpty) {
    // 空ブロック
    return `${delim}\n${delim}\n${bodySuffix}`;
  }

  const yamlBlock = yamlStringify(data, { lineWidth: 0 });
  // yamlBlock は常に LF 末尾の文字列 (yaml パッケージの仕様)
  return `${delim}\n${yamlBlock}${delim}\n${bodySuffix}`;
}
