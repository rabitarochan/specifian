/**
 * lint コア — POST /api/lint および MCP lint ツールから共用する。
 * 4 つのチェック (yaml / mdx / wikilink / schema) を全件収集して返す。
 */

import matter from 'gray-matter';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import Ajv from 'ajv';
import { WIKILINK_PATTERN, type LintIssue, type LintRequest } from '../shared/types.js';
import { loadSpecs } from './store.js';
import { loadCategorySchema } from './validate.js';

/** コードフェンスとインラインコードを除去する (store.ts の stripCodeBlocks と同等) */
function stripCodeBlocks(src: string): string {
  let result = src.replace(/```[\s\S]*?```/g, '');
  result = result.replace(/`[^`]*`/g, '');
  return result;
}

/**
 * 本文 (front-matter 除去済み) から wiki リンク ID を抽出する。
 * store.ts の extractLinks と同じアルゴリズム。重複排除済み。
 */
function extractWikilinkIds(body: string): string[] {
  const stripped = stripCodeBlocks(body);
  const seen = new Set<string>();
  const ids: string[] = [];
  const re = new RegExp(WIKILINK_PATTERN.source, WIKILINK_PATTERN.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const target = m[1].trim();
    if (!target.includes(':')) continue;
    if (!seen.has(target)) {
      seen.add(target);
      ids.push(target);
    }
  }
  return ids;
}

/**
 * validate.ts の ajv エラーを日本語メッセージに変換する (validate.ts と同じロジックをミラー)。
 */
function ajvErrorToMessage(err: {
  instancePath: string;
  keyword: string;
  message?: string;
  params?: Record<string, unknown>;
}): string {
  let message = err.message ?? 'バリデーションエラー';

  if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
    message = `必須プロパティがありません: '${String(err.params['missingProperty'])}'`;
  } else if (err.keyword === 'additionalProperties' && err.params && 'additionalProperty' in err.params) {
    message = `許可されていないプロパティ: '${String(err.params['additionalProperty'])}'`;
  } else if (err.keyword === 'enum' && err.params && 'allowedValues' in err.params) {
    const allowed = (err.params['allowedValues'] as unknown[]).join(', ');
    message = `${err.message ?? 'enum エラー'} (許可値: ${allowed})`;
  } else if (err.keyword === 'type' && err.params && 'type' in err.params) {
    message = `型が正しくありません: ${String(err.params['type'])} が必要です`;
  }

  return message;
}

/**
 * 4 つのルール (yaml / mdx / wikilink / schema) を全件検査して返す。
 * エラーが出ても途中で停止せず全チェックを実行する。
 *
 * @param specsDir - specs ディレクトリーの絶対パス (wikilink 解決・スキーマ取得に使用)
 * @param req      - LintRequest (content 必須、category/slug は任意)
 */
export async function lintContent(
  specsDir: string,
  req: LintRequest,
): Promise<LintIssue[]> {
  const issues: LintIssue[] = [];
  const { content, category, slug } = req;

  // --- 1. YAML パース (gray-matter) ---
  let frontmatterData: Record<string, unknown> = {};
  let bodyContent = content; // フォールバック: 全文をそのまま wikilink/mdx チェックに使う
  let yamlFailed = false;

  try {
    const parsed = matter(content);
    frontmatterData = parsed.data as Record<string, unknown>;
    bodyContent = parsed.content;
  } catch (err) {
    yamlFailed = true;
    // gray-matter / js-yaml のエラーは Error または YAMLException。行情報を取れる場合は付与する。
    const e = err as Error & { mark?: { line?: number } };
    const rawLine = e.mark?.line;
    // js-yaml の line は 0 始まり → 1 始まりに変換
    const line = typeof rawLine === 'number' ? rawLine + 1 : undefined;
    issues.push({
      severity: 'error',
      rule: 'yaml',
      message: `YAML パースエラー: ${e.message}`,
      ...(line !== undefined ? { line } : {}),
    });
    // YAML 失敗時はスキーマ検証をスキップするが、mdx/wikilink は全文に対して続行する
    bodyContent = content;
  }

  // --- 2. MDX 構文チェック (@mdx-js/mdx compile) ---
  try {
    await compile(content, {
      remarkPlugins: [remarkGfm, remarkFrontmatter],
      // VFile のメッセージ (warnings) は必要ないのでサイレント
    });
  } catch (err) {
    // compile() は VFileMessage (= Error のサブクラス) を throw する
    const e = err as Error & {
      line?: number;
      column?: number;
      reason?: string;
    };
    const message = e.reason ?? e.message ?? 'MDX コンパイルエラー';
    const issue: LintIssue = {
      severity: 'error',
      rule: 'mdx',
      message,
    };
    if (typeof e.line === 'number') issue.line = e.line;
    if (typeof e.column === 'number') issue.column = e.column;
    issues.push(issue);
  }

  // --- 3. wiki リンク解決チェック ---
  try {
    const allSpecs = await loadSpecs(specsDir);
    // _template は除外 (store.ts / search.ts と同様)、_ インデックスは含める
    const knownIds = new Set(
      allSpecs.filter((s) => s.slug !== '_template').map((s) => s.id),
    );

    const ids = extractWikilinkIds(bodyContent);
    const seenUnresolved = new Set<string>();
    for (const id of ids) {
      if (!knownIds.has(id) && !seenUnresolved.has(id)) {
        seenUnresolved.add(id);
        issues.push({
          severity: 'warning',
          rule: 'wikilink',
          message: `未解決の wiki リンク: [[${id}]]`,
        });
      }
    }
  } catch {
    // specs ディレクトリーが存在しない等は wikilink チェックをスキップ
  }

  // --- 4. スキーマ検証 (category 指定かつ通常スペックの場合のみ) ---
  // yaml 失敗時はスキップ (front-matter が取れていないため)
  if (!yamlFailed && category !== undefined) {
    // slug が '_' または '_template' の場合はスキーマ検証対象外
    const effectiveSlug = slug ?? '';
    const isNormalSpec = effectiveSlug !== '_' && effectiveSlug !== '_template';

    if (isNormalSpec) {
      try {
        const schemaResult = await loadCategorySchema(specsDir, category);

        if (schemaResult.error !== undefined) {
          // スキーマ読み込みエラー自体は lint issue として報告しない (サーバー側の問題)
          // 必要に応じてここに追加できる
        } else if (schemaResult.schema !== null) {
          const ajv = new Ajv({ allErrors: true, strict: false });
          let validate: ReturnType<Ajv['compile']>;
          try {
            validate = ajv.compile(schemaResult.schema);
          } catch {
            // スキーマ自体のコンパイルエラーは lint issue として報告しない
            validate = null as unknown as ReturnType<Ajv['compile']>;
          }

          if (validate) {
            const valid = validate(frontmatterData);
            if (!valid && validate.errors) {
              for (const err of validate.errors) {
                const instancePath = err.instancePath || '/';
                const message = ajvErrorToMessage({
                  instancePath,
                  keyword: err.keyword,
                  message: err.message,
                  params: err.params as Record<string, unknown> | undefined,
                });
                issues.push({
                  severity: 'error',
                  rule: 'schema',
                  message: `${instancePath}: ${message}`,
                });
              }
            }
          }
        }
      } catch {
        // スキーマ検証中の予期しないエラーはスキップ
      }
    }
  }

  return issues;
}
