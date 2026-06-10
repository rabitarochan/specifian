# specbook 設計ドキュメント

Storybook のように、ローカルの `specs/` 配下の `.mdx` ファイルをドキュメントとして表示・編集する Web ツール。
front-matter を「構造化された設計データ」として扱い、React コンポーネントから参照したり、API / コード生成に活用できる。

## コンセプト

- **Markdown (MDX) がソース・オブ・トゥルース**。Git で管理でき、VSCode でも Web UI でも編集できる。
- **front-matter = 設計データ**。MDX 本文から `data` として参照でき、API で一括取得でき、scaffdog テンプレートでコード生成できる。
- **どのプロジェクトにも適用可能**。`specs/` 配下のフォルダー構成は自由。

## 技術スタック

| 領域 | 技術 |
|---|---|
| 言語 | TypeScript (strict), ESM (`"type": "module"`) |
| CLI | commander |
| サーバー | Express 4 + ws (WebSocket) + chokidar (ファイル監視) + gray-matter |
| クライアント | React 18 + react-router-dom 6 + Vite 5 |
| MDX | @mdx-js/mdx v3 ランタイム評価 (`evaluate`) + remark-gfm + remark-frontmatter + remark-mdx-frontmatter |
| エディター | @uiw/react-codemirror + @codemirror/lang-markdown |
| グラフ | d3-force (SVG 描画は自前 React コンポーネント) |
| コード生成 | @scaffdog/engine |
| ビルド | tsup (CLI/server → dist/), vite build (client → dist/client) |

Node >= 20。Windows 対応必須 (パス区切りは内部的に常に `/` へ正規化)。

## ディレクトリ構成 (このリポジトリー)

```
specbook/
  package.json / tsconfig.json / tsup.config.ts / vite.config.ts
  docs/DESIGN.md
  src/
    shared/types.ts        # API 契約・共有型 (サーバー/クライアント両方から import)
    cli/index.ts           # bin エントリー (serve / init / generate)
    server/                # Express サーバー (担当: server agent)
      app.ts               # createApp(specsDir): Express app + ws のセットアップ
      store.ts             # specs ディレクトリーの走査・SpecMeta 構築・キャッシュ
      watcher.ts           # chokidar -> ws ブロードキャスト
      routes/              # API ルート
      generate.ts          # scaffdog エンジンによるコード生成
      init.ts              # specbook init (examples/specs をコピー)
    client/                # React アプリ (担当: client agent)
      index.html
      main.tsx / App.tsx
      api.ts               # fetch ラッパー (types.ts の契約に従う)
      ws.ts                # WebSocket 購読
      mdx/                 # MDX ランタイムコンパイル (evaluate + remark プラグイン)
      components/          # 組み込みコンポーネント (TableDefinition, SpecList, ...)
      pages/               # Home / SpecPage / GraphPage
      styles/
  examples/specs/          # サンプルコンテンツ (担当: content agent。init のテンプレート兼開発用)
  README.md
```

## specs/ のルール (ユーザーのプロジェクト側)

- `specs/` 配下の任意の深さのフォルダー = **カテゴリー** (例: `tables`, `api/v1`)
- `<category>/<slug>.mdx` = **スペック**。ID は `<category>:<slug>` (例: `tables:users`)
- `<category>/_.mdx` = カテゴリーの **インデックスページ** (index.html 相当)。slug は `_`
- `<category>/_template.mdx` = 新規スペック作成時の **テンプレート**。一覧・グラフから除外
- `specs/_generators/*.md` = scaffdog 形式の **コード生成テンプレート** (スペック扱いしない)
- front-matter (YAML) は自由スキーマ。`title` / `description` は UI が解釈する予約キー

## wiki リンク

- 記法: `[[tables:users]]` または `[[tables:users|表示名]]`
- `[[tables:users]]` → `specs/tables/users.mdx` へのリンク (クライアントルート `/specs/tables/users`)
- `[[tables:_]]` でカテゴリーインデックスへのリンクも可
- 抽出 (サーバー側・グラフ用): 正規表現 `/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g`。
  ただしコードフェンス内・インラインコード内は除外する
- 描画 (クライアント側): text ノードを走査して link 要素へ置換する remark プラグイン

## API 契約 (src/shared/types.ts が正)

ベース: `http://localhost:<port>`。カテゴリーはネスト可のためワイルドカードルートを使う。
すべての path/category/id はスラッシュ `/` 区切り。

| メソッド/パス | 説明 |
|---|---|
| `GET /api/specs` | 全 SpecMeta 一覧 (`_template` 除く) |
| `GET /api/specs/<categoryPath>/<slug>` | 1 件取得 → `{ meta: SpecMeta, content: string }` (content は front-matter 込みの生テキスト) |
| `PUT /api/specs/<categoryPath>/<slug>` | body `{ content: string }` で保存 → `{ meta }`。存在しないパスは 404 |
| `POST /api/specs` | body `{ category, slug, title? }`。`<category>/_template.mdx` があればコピー (front-matter の title を差し替え)、なければ最小テンプレート。409 if exists |
| `POST /api/categories` | body `{ path }`。フォルダー作成 + デフォルト `_.mdx` / `_template.mdx` 生成。409 if exists |
| `GET /api/data` | `{ [category]: { [slug]: frontmatter } }` 全データ (`_template` 除く、`_` 含む) |
| `GET /api/data/<categoryPath>` | `{ [slug]: frontmatter }` |
| `GET /api/graph` | `{ nodes: GraphNode[], edges: GraphEdge[] }` (wiki リンクから構築。解決できないリンク先は `missing: true` のノードとして含める) |
| `GET /api/generators` | 利用可能なジェネレーター名一覧 |
| `POST /api/generate` | body `{ generator, specId?, out? }` → `{ files: { path, content }[] }` (out 指定時は書き込みも行う) |
| `WS /ws` | `{ type: 'fs', event: 'add'\|'change'\|'unlink', specId, path }` をブロードキャスト |

- エラーは `{ error: string }` + 適切なステータスコード
- **パストラバーサル対策必須**: 解決後の絶対パスが specsDir 配下であることを検証
- 書き込みは UTF-8 (BOM なし)、改行は入力を尊重

### SpecMeta (共有型、詳細は types.ts)

```ts
interface SpecMeta {
  id: string;        // "tables:users" / "tables:_" (カテゴリーは "/" を含み得る: "api/v1:users")
  category: string;  // "tables", "api/v1"
  slug: string;      // "users", "_"
  path: string;      // "tables/users.mdx" (specsDir 相対, "/" 区切り)
  title: string;     // frontmatter.title ?? slug
  description?: string;
  data: Record<string, unknown>; // front-matter 全体
  links: string[];   // 本文中の wiki リンク先 ID
  isIndex: boolean;  // slug === "_"
}
```

## MDX 実行環境 (クライアント)

- `GET /api/specs/...` の content を `@mdx-js/mdx` の `evaluate` でその場コンパイル
- remark プラグイン: remark-gfm → remark-frontmatter → remark-mdx-frontmatter (`name: "data"`) → wiki リンクプラグイン → **scope 注入プラグイン** (`export const specs = <JSON>`, `export const category = "..."`, `export const slug = "..."` を mdxjs-esm ノードとして注入)
- これにより MDX 本文で `data` (自身の front-matter)、`specs` (全 SpecMeta 配列)、`category`、`slug` が裸の識別子として使える
- コンパイルエラー時はアプリを落とさず、エラーメッセージパネルを表示 (ErrorBoundary + try/catch)

### 組み込みコンポーネント (MDX 内で import 不要)

- `<TableDefinition data={...} />` — DB テーブル定義の描画。`{ name, description?, columns: [{ name, type, nullable?, default?, primaryKey?, description? }] }`
- `<SpecList category="tables" />` — カテゴリー内スペックの一覧 (title / description / リンク)。category 省略時は自カテゴリー
- `<DataView data={...} />` — オブジェクトの整形表示 (折りたたみ可能な JSON ビュー)
- `<SpecLink to="tables:users">...</SpecLink>` — wiki リンクのコンポーネント版
- 通常の Markdown 要素 (table, code, blockquote...) もスタイル適用

## クライアント UI

ルーティング (BrowserRouter、サーバーは非 API パスを index.html へフォールバック):

- `/` — ホーム。specs ルートの `_.mdx` があれば描画、なければカテゴリー一覧
- `/specs/<categoryPath>` — カテゴリーインデックス (`_.mdx` がなければ自動生成の一覧)
- `/specs/<categoryPath>/<slug>` — スペック表示
- `/graph` — リンクグラフ (d3-force。カテゴリー別に色分け、ドラッグ可、クリックでそのスペックへ遷移、欠損ノードは破線)

レイアウト: Storybook 風。左サイドバーにカテゴリーツリー (フォルダー/ファイル追加ボタン付き)、上部にタイトルバー (表示/編集トグル、グラフへのリンク)、中央コンテンツ。
編集モード: 左 CodeMirror / 右ライブプレビュー (300ms デバウンス) のスプリットビュー。Ctrl+S と保存ボタンで PUT。
WebSocket で fs イベント受信 → ツリー再取得。表示中ファイルが外部変更されたら、未編集なら自動リロード、編集中なら警告バナー表示。
UI は日本語。クリーンでモダンな配色 (ライトテーマ、アクセントカラー 1 色)、プレーン CSS。

## CLI

```
specbook [serve] [--dir <specsDir>=./specs] [--port <port>=4400] [--open]
specbook init [--dir ./specs]          # examples/specs 同梱物をコピーして雛形作成
specbook generate <generator> [--dir ./specs] [--spec <id>] [--out <dir>=.]
```

`serve` は dist/client を静的配信。`generate` は `specs/_generators/<generator>.md` (scaffdog ドキュメント形式: front-matter + ファイル名付きコードフェンス) を `@scaffdog/engine` でレンダリング。テンプレート変数: `spec` (対象 SpecMeta、`spec.data` が front-matter)、`specs` (全件)。`--spec` 省略時は全スペックに対して生成。

## 開発スクリプト

- `npm run dev` — server (tsx watch, port 4399, examples/specs) + vite dev (port 5180, /api と /ws を 4399 へ proxy) を concurrently 起動
- `npm run build` — tsup + vite build
- `npm start` — ビルド済みを examples/specs で起動

## 将来拡張 (v2, 今回は実装しない)

- `specs/_components/*.tsx` によるユーザー定義コンポーネントの動的ロード
- 全文検索、Mermaid 対応、front-matter のスキーマバリデーション
