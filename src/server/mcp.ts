/**
 * mcp.ts — specifian の MCP サーバー (stdio トランスポート)。
 *
 * AI エージェント (Claude Code 等) が specifian のスペックドキュメントを
 * MCP ツール経由で読み書きできるようにする。
 *
 * 重要: stdout は MCP (JSON-RPC) プロトコルに占有されているため、
 *       絶対に stdout へ書き込まないこと。ログはすべて console.error (stderr) へ。
 *
 * 設計: docs/DESIGN.md「v5 機能設計: MCP サーバー」参照。
 * 既存のサーバーモジュール (store / searchCore / lintCore / specOps /
 * validate / generate) を再利用し、HTTP ルートと同じ意味論を保つ。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadSpecs, loadSpec, guardPath } from './store.js';
import { searchSpecs } from './searchCore.js';
import { lintContent } from './lintCore.js';
import {
  findRefs,
  renameSpec,
  deleteSpec,
  SpecOpsError,
} from './specOps.js';
import { validateSpecs } from './validate.js';
import { runGenerator, listGenerators } from './generate.js';
import {
  parseSpecId,
  toSpecId,
  type SpecMeta,
  type LintIssue,
} from '../shared/types.js';

// ─── ツール結果ヘルパー ───────────────────────────────────────────────────────

/** 任意の値を JSON 文字列の text content に詰めて返す (成功レスポンス) */
function ok(result: unknown): {
  content: { type: 'text'; text: string }[];
} {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}

/** エラーレスポンス (isError: true)。SpecOpsError 等のメッセージをそのまま渡す */
function fail(message: string): {
  content: { type: 'text'; text: string }[];
  isError: true;
} {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

/** unknown なエラーから人間可読なメッセージを取り出す */
function errMessage(err: unknown): string {
  if (err instanceof SpecOpsError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

// ─── パス解決 (HTTP ルートと同じトラバーサルガード) ──────────────────────────

/**
 * category + slug からスペックの絶対パスを解決する。
 * specsDir 外を指す場合は null を返す (呼び出し側でエラー化)。
 * HTTP ルート (routes/specs.ts) の guardPath と同じ意味論。
 */
function resolveMdxPath(
  specsDir: string,
  category: string,
  slug: string,
): string | null {
  const parts = category === '' ? [] : category.split('/');
  const target = path.join(specsDir, ...parts, `${slug}.mdx`);
  if (!guardPath(specsDir, target)) return null;
  return target;
}

/** 指定 ID のスペック meta を loadSpecs から再構築して返す (見つからなければ null) */
async function findMeta(specsDir: string, id: string): Promise<SpecMeta | null> {
  const specs = await loadSpecs(specsDir);
  return specs.find((s) => s.id === id) ?? null;
}

// ─── サーバー起動 ──────────────────────────────────────────────────────────────

/**
 * specifian の MCP サーバーを stdio トランスポートで起動する。
 * Promise はトランスポートが閉じる (= プロセス終了相当) まで解決しない。
 *
 * @param specsDir - specs ディレクトリーの絶対パス (呼び出し側で存在確認済みを想定)
 */
export async function startMcpServer(specsDir: string): Promise<void> {
  const server = new McpServer({ name: 'specifian', version: '0.1.0' });

  // ── list_specs ──────────────────────────────────────────────────────────
  server.registerTool(
    'list_specs',
    {
      description:
        'specs ディレクトリー内の全スペックのメタ情報 (SpecMeta[]) を返します。' +
        '各要素には id ("category:slug" 形式)、category、slug、path、title、' +
        'description、front-matter 全体 (data)、本文中の wiki リンク先 ID (links)、' +
        'isIndex が含まれます。_template は除外されます。',
      inputSchema: {},
    },
    async () => {
      try {
        const specs = await loadSpecs(specsDir);
        return ok(specs.filter((s) => s.slug !== '_template'));
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── read_spec ───────────────────────────────────────────────────────────
  server.registerTool(
    'read_spec',
    {
      description:
        '指定したスペックの meta と content を返します。' +
        'id は "category:slug" 形式 (例: "tables:users"、インデックスは "tables:_")。' +
        'content は front-matter を含む生の MDX 全文です。' +
        '存在しない場合はエラーになります。',
      inputSchema: {
        id: z
          .string()
          .describe('スペック ID。"category:slug" 形式 (例: "tables:users")'),
      },
    },
    async ({ id }) => {
      const parsed = parseSpecId(id);
      if (!parsed) return fail(`無効なスペック ID: ${id}`);
      const target = resolveMdxPath(specsDir, parsed.category, parsed.slug);
      if (!target) return fail('パストラバーサルは許可されていません');
      const result = await loadSpec(specsDir, target);
      if (!result) return fail(`スペックが見つかりません: ${id}`);
      return ok(result);
    },
  );

  // ── write_spec ──────────────────────────────────────────────────────────
  server.registerTool(
    'write_spec',
    {
      description:
        '既存スペックの内容を上書き保存します。' +
        'id は "category:slug" 形式。content は front-matter を含む MDX 全文。' +
        '対象が存在しない場合はエラーになります (新規作成は create_spec を使ってください)。' +
        '保存後に lint を実行し、{ meta, issues } を返します ' +
        '(issues は情報提供であり、保存自体は常に実行されます)。',
      inputSchema: {
        id: z
          .string()
          .describe('上書きする既存スペックの ID。"category:slug" 形式'),
        content: z
          .string()
          .describe('front-matter を含む MDX 全文 (ファイル全体を置き換えます)'),
      },
    },
    async ({ id, content }) => {
      const parsed = parseSpecId(id);
      if (!parsed) return fail(`無効なスペック ID: ${id}`);
      const target = resolveMdxPath(specsDir, parsed.category, parsed.slug);
      if (!target) return fail('パストラバーサルは許可されていません');

      // 既存スペックのみ対象 (存在チェック)
      try {
        await fs.access(target);
      } catch {
        return fail(
          `スペックが見つかりません: ${id}。新規作成は create_spec を使ってください。`,
        );
      }

      try {
        await fs.writeFile(target, content, 'utf-8');
      } catch (err) {
        return fail(`保存に失敗しました: ${errMessage(err)}`);
      }

      const meta = await findMeta(specsDir, id);

      // 保存後 lint (失敗しても保存は成功扱い)
      let issues: LintIssue[];
      try {
        issues = await lintContent(specsDir, {
          content,
          category: parsed.category,
          slug: parsed.slug,
        });
      } catch (lintErr) {
        console.error('[mcp] lintContent 失敗 (無視):', lintErr);
        issues = [];
      }

      return ok({ meta, issues });
    },
  );

  // ── create_spec ─────────────────────────────────────────────────────────
  server.registerTool(
    'create_spec',
    {
      description:
        '新規スペックを作成します (POST /api/specs と同じ意味論)。' +
        'category はカテゴリーパス ("/" 区切り、例: "tables" や "api/v1")、slug はファイル名 (拡張子なし)。' +
        'カテゴリーディレクトリーは事前に存在している必要があります。' +
        '同名スペックが既に存在する場合はエラーになります。' +
        'カテゴリー内に _template.mdx があればそれをコピーし front-matter の title を置き換えます。' +
        '無ければ最小テンプレート (title + 見出し) を生成します。戻り値は { meta }。',
      inputSchema: {
        category: z
          .string()
          .describe('カテゴリーパス ("/" 区切り。ルート直下は空文字)。例: "tables"'),
        slug: z.string().describe('スペックのファイル名 (拡張子なし)。例: "users"'),
        title: z
          .string()
          .optional()
          .describe('front-matter の title。省略時は slug が使われます'),
      },
    },
    async ({ category, slug, title }) => {
      if (!slug) return fail('slug は必須です');
      const cat = category ?? '';
      const effectiveTitle = title ?? slug;

      const target = resolveMdxPath(specsDir, cat, slug);
      if (!target) return fail('パストラバーサルは許可されていません');

      const categoryParts = cat === '' ? [] : cat.split('/');
      const categoryDir = path.join(specsDir, ...categoryParts);

      // カテゴリーディレクトリーの存在確認 (MCP は mkdir しない)
      try {
        const stat = await fs.stat(categoryDir);
        if (!stat.isDirectory()) {
          return fail(`カテゴリーがディレクトリーではありません: ${cat}`);
        }
      } catch {
        return fail(`カテゴリーディレクトリーが存在しません: ${cat || '(ルート)'}`);
      }

      // 既存チェック (409 相当)
      try {
        await fs.access(target);
        return fail(`"${slug}" は既に存在します`);
      } catch {
        // 期待どおり存在しない
      }

      // テンプレート適用 (無ければ最小テンプレート)
      let content: string;
      const templatePath = path.join(categoryDir, '_template.mdx');
      try {
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        const parsed = matter(templateContent);
        parsed.data['title'] = effectiveTitle;
        content = matter.stringify(parsed.content, parsed.data);
      } catch {
        content = `---\ntitle: ${effectiveTitle}\n---\n\n# ${effectiveTitle}\n`;
      }

      try {
        await fs.writeFile(target, content, 'utf-8');
      } catch (err) {
        return fail(`作成に失敗しました: ${errMessage(err)}`);
      }

      const id = toSpecId(cat, slug);
      const meta = await findMeta(specsDir, id);
      if (!meta) return fail('作成後のスペック読み込みに失敗しました');
      return ok({ meta });
    },
  );

  // ── rename_spec ─────────────────────────────────────────────────────────
  server.registerTool(
    'rename_spec',
    {
      description:
        'スペックのファイル名を変更し、他の全スペックの wiki リンク [[from]] / [[from|ラベル]] を' +
        '一括で [[to]] へ書き換えます (コードフェンス・インラインコード内は変更しません)。' +
        'from / to はともに "category:slug" 形式のスペック ID。' +
        'to のカテゴリーディレクトリーは存在している必要があります。' +
        'インデックス (slug "_") / テンプレート (slug "_template") はリネームできません。' +
        '戻り値は { meta, rewrittenFiles } (rewrittenFiles は実際にリンクを書き換えたスペック ID 一覧)。',
      inputSchema: {
        from: z.string().describe('変更元スペック ID。"category:slug" 形式'),
        to: z.string().describe('変更先スペック ID。"category:slug" 形式'),
      },
    },
    async ({ from, to }) => {
      try {
        const result = await renameSpec(specsDir, from, to);
        return ok(result);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── delete_spec ─────────────────────────────────────────────────────────
  server.registerTool(
    'delete_spec',
    {
      description:
        'スペックを削除します。id は "category:slug" 形式。' +
        '削除前に参照元 (この ID を wiki リンクしているスペック) を調べ、' +
        '戻り値 { ok: true, brokenRefs } で「壊れた参照」を通知します。' +
        'brokenRefs が非空の場合、それらのスペックは未解決リンクを抱えることになります。' +
        'インデックス (slug "_") やテンプレートも削除可能です。',
      inputSchema: {
        id: z.string().describe('削除するスペック ID。"category:slug" 形式'),
      },
    },
    async ({ id }) => {
      try {
        // 削除前に参照元を取得 (削除後だと links から消えるため)
        const refs = await findRefs(specsDir, id);
        await deleteSpec(specsDir, id);
        return ok({ ok: true, brokenRefs: refs });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── get_refs ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_refs',
    {
      description:
        '指定 ID を wiki リンクで参照しているスペック ID 一覧 ({ refs }) を返します。' +
        'id は "category:slug" 形式。バックリンク確認や削除影響範囲の調査に使います。',
      inputSchema: {
        id: z.string().describe('参照元を調べたいスペック ID。"category:slug" 形式'),
      },
    },
    async ({ id }) => {
      try {
        const refs = await findRefs(specsDir, id);
        return ok({ refs });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── search ──────────────────────────────────────────────────────────────
  server.registerTool(
    'search',
    {
      description:
        'スペックを全文検索します。title > description > front-matter (data) > 本文 の優先順で' +
        'マッチし、各ヒットに snippet (前後の文脈付き抜粋) と field (マッチ箇所) が付きます。' +
        '_template は検索対象外。戻り値は SearchResult[]。',
      inputSchema: {
        query: z.string().describe('検索クエリー文字列 (大文字小文字を区別しません)'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('最大返却件数。省略時は 20'),
      },
    },
    async ({ query, limit }) => {
      try {
        const results = await searchSpecs(specsDir, query, limit ?? 20);
        return ok(results);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── get_data ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_data',
    {
      description:
        'スペックの front-matter (data) をまとめて返します。' +
        'category を省略した場合は { category: { slug: data } } のネスト構造 (全カテゴリー)。' +
        'category を指定した場合はそのカテゴリーの { slug: data } のみ。' +
        '_template は除外されます。テーブル定義一覧の取得などに便利です。',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe('カテゴリーパス ("/" 区切り)。省略時は全カテゴリー'),
      },
    },
    async ({ category }) => {
      try {
        const specs = await loadSpecs(specsDir);
        const filtered = specs.filter((s) => s.slug !== '_template');
        if (category === undefined) {
          const result: Record<string, Record<string, unknown>> = {};
          for (const spec of filtered) {
            const cat = spec.category;
            if (!result[cat]) result[cat] = {};
            (result[cat] as Record<string, unknown>)[spec.slug] = spec.data;
          }
          return ok(result);
        }
        const cat = category.split('/').filter(Boolean).join('/');
        const result: Record<string, unknown> = {};
        for (const spec of filtered) {
          if (spec.category === cat) result[spec.slug] = spec.data;
        }
        return ok(result);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── validate ────────────────────────────────────────────────────────────
  server.registerTool(
    'validate',
    {
      description:
        '_schema.json を持つカテゴリーについて、全スペックの front-matter を JSON Schema (ajv) で' +
        '検証し、違反一覧 (ValidationReport { issues }) を返します。issues が空なら全件適合です。',
      inputSchema: {},
    },
    async () => {
      try {
        const report = await validateSpecs(specsDir);
        return ok(report);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── lint ────────────────────────────────────────────────────────────────
  server.registerTool(
    'lint',
    {
      description:
        '保存せずに MDX 全文を検証し、issues (LintIssue[]) を返します。' +
        'チェック内容: YAML パース / MDX 構文 / wiki リンク解決 / (category 指定時) スキーマ検証。' +
        'content は front-matter を含む MDX 全文。category/slug を渡すとスキーマ検証も行われます。' +
        '保存前の事前チェックに使ってください。',
      inputSchema: {
        content: z.string().describe('front-matter を含む MDX 全文'),
        category: z
          .string()
          .optional()
          .describe('スキーマ検証に使うカテゴリー。省略時はスキーマ検証をスキップ'),
        slug: z
          .string()
          .optional()
          .describe('対象 slug。"_" / "_template" はスキーマ検証対象外になります'),
      },
    },
    async ({ content, category, slug }) => {
      try {
        const issues = await lintContent(specsDir, { content, category, slug });
        return ok({ issues });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── list_generators ─────────────────────────────────────────────────────
  server.registerTool(
    'list_generators',
    {
      description:
        'specs/_generators/ 配下のコードジェネレーター名一覧 (string[]) を返します。' +
        'generate ツールの generator 引数に使えます。',
      inputSchema: {},
    },
    async () => {
      try {
        const generators = await listGenerators(specsDir);
        return ok(generators);
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── generate ────────────────────────────────────────────────────────────
  server.registerTool(
    'generate',
    {
      description:
        'コードジェネレーターを実行します。generator は list_generators で得られる名前。' +
        'specId ("category:slug") を指定するとそのスペックのみ、省略時は全スペックが対象。' +
        'out を指定するとプロセスの cwd 相対でファイルをディスクに書き出します ' +
        '(省略時は書き込まずレスポンスのみ)。戻り値は { files: { path, content }[] }。',
      inputSchema: {
        generator: z
          .string()
          .describe('ジェネレーター名 (specs/_generators/<name>.md)'),
        specId: z
          .string()
          .optional()
          .describe('対象スペック ID。"category:slug" 形式。省略時は全スペック'),
        out: z
          .string()
          .optional()
          .describe('出力先ディレクトリー (cwd 相対)。省略時はディスクに書き込みません'),
      },
    },
    async ({ generator, specId, out }) => {
      try {
        const allSpecs = await loadSpecs(specsDir);
        const files = await runGenerator(
          specsDir,
          generator,
          allSpecs,
          specId,
          out,
        );
        return ok({ files });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── トランスポート接続 ────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // トランスポートが閉じるまでプロセスを生かす。
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}
