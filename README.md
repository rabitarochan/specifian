# specifian

Storybook のように、ローカルの `specs/` 配下の `.mdx` ファイルを Markdown で記述し、Web UI で表示・編集できる設計ドキュメント管理ツールです。**front-matter を構造化設計データとして扱う** ため、API でのデータ取得やコード生成テンプレートへの入力として活用できます。

## 特徴

- **MDX レンダリング・Web 編集** — specs/ の MDX ファイルをリアルタイムで Web UI で表示・編集可能。ファイル監視により外部編集も自動反映
- **front-matter がデータ API** — 各スペックの YAML front-matter を構造化設計データとして扱い、React コンポーネントや REST API で参照可能
- **wiki リンク・グラフ可視化** — `[[category:slug]]` の形式で同プロジェクト内のスペック間をリンク。グラフページでリンクネットワークをインタラクティブに表示
- **テンプレートからのスペック作成** — カテゴリーごとに `_template.mdx` を用意することで、新規スペック作成時に自動的にテンプレートをコピー
- **scaffdog テンプレートによるコード生成** — `_generators/*.md` に scaffdog 形式のテンプレートを記述し、スペック情報をコード生成に活用
- **ユーザー定義コンポーネント** — `specs/_components/*.tsx` に React コンポーネントを置くと、import 不要で全 MDX から利用可能。useState などフックを使ったインタラクティブな設計画面も作れる
- **Mermaid 図** — ` ```mermaid ` フェンスでフローチャートや ER 図を描画
- **全文検索** — `Ctrl+K` / `Cmd+K` のコマンドパレットで title / description / front-matter / 本文を横断検索
- **スキーマバリデーション** — カテゴリーに `_schema.json` (JSON Schema) を置くと front-matter を検証。Web UI に警告表示、`specifian validate` で CI 連携も可能
- **フォーム編集** — `_schema.json` から編集フォームを自動生成。エディターの [フォーム] タブで front-matter を GUI 編集（カラム定義はテーブル UI で行の追加・削除が可能）。スキーマが無い場合も既存データから型推論してフォームを生成
- **画面設計 (Excalidraw)** — `<Drawing src="screens/login" />` で Excalidraw のワイヤーフレームを MDX に埋め込み。閲覧は静的 SVG、クリックで編集モーダル。図は `specs/**/*.excalidraw` として Git 管理
- **TypeScript + React** — 最新の Web スタック。クライアント・サーバー双方を TypeScript で実装

## インストールと使い方

```bash
npm install -g specifian
# またはプロジェクトに導入
npm install -D specifian
```

### はじめる

```bash
# サンプル入りの specs/ を作成
specifian init

# サーバー起動 (http://localhost:4400)
specifian serve
```

ブラウザーで `http://localhost:4400` を開き、サンプルスペックが表示されることを確認します。
`npx specifian serve` のように npx 経由でも実行できます。

### 日常の使い方

```bash
# specs ディレクトリーとポートを指定してサーバー起動
specifian serve --dir ./specs --port 4400

# コード生成テンプレートからコード生成
specifian generate typescript-interface --out ./src/generated

# CI などでの front-matter スキーマ検証 (違反があれば exit 1)
specifian validate --dir ./specs
```

### CLI コマンド

| コマンド | 説明 |
|---|---|
| `specifian serve [--dir ./specs] [--port 4400] [--open]` | 開発サーバー起動。`--open` でブラウザー自動起動 |
| `specifian init [--dir ./specs]` | テンプレートから specs/ を初期化 |
| `specifian generate <generator> [--dir ./specs] [--spec <id>] [--out .]` | scaffdog テンプレートからコード生成 |
| `specifian validate [--dir ./specs]` | `_schema.json` で front-matter を検証。違反があれば exit code 1 |
| `specifian mcp [--dir ./specs]` | MCP サーバー (stdio) を起動。AI エージェントがスペックを読み書きできる |

## specs/ の構成ルール

specifian の動作を理解するため、specs/ のファイル構成を把握しておきましょう。

- **`specs/<category>/`** — カテゴリー（フォルダー）。ネストも可（例: `specs/api/v1/`）
- **`specs/<category>/<slug>.mdx`** — スペック。ID は `<category>:<slug>` 形式（例: `tables:users`）
- **`specs/<category>/_.mdx`** — カテゴリーインデックス。该カテゴリーのスペック一覧などを表示
- **`specs/<category>/_template.mdx`** — テンプレート。新規スペック作成時に自動的にコピー
- **`specs/_generators/*.md`** — scaffdog 形式のコード生成テンプレート（スペック扱いしない）

### ファイル例

```
specs/
  _.mdx                          # ホームページ（ルート）
  tables/
    _.mdx                        # テーブルカテゴリーのインデックス
    _template.mdx                # テーブル作成時のテンプレート
    users.mdx                    # ユーザーテーブル定義
    posts.mdx                    # 投稿テーブル定義
  api/
    _.mdx                        # API カテゴリーのインデックス
    _template.mdx                # API スペック作成時のテンプレート
    users-api.mdx                # ユーザー API 仕様
  screens/
    _.mdx                        # 画面設計カテゴリーのインデックス
    _template.mdx                # 画面スペック作成時のテンプレート
    login.mdx                    # ログイン画面仕様
    login.excalidraw             # ログイン画面のワイヤーフレーム
  _generators/
    typescript.md                # TypeScript 型定義生成テンプレート
```

## front-matter とコンポーネント

### front-matter の役割

各 `.mdx` ファイルの YAML front-matter は、その設計ドキュメントのメタデータです。

```markdown
---
title: users テーブル
description: ユーザーアカウント情報
table:
  name: users
  columns:
    - { name: id, type: bigint, primaryKey: true }
    - { name: email, type: varchar(255) }
---
```

front-matter は `data` 変数として MDX 内から参照できます。また、REST API(`GET /api/data`) でも一括取得可能です。

### MDX 内で使える変数

MDX 本文では、以下の変数を直接使用できます：

- **`data`** — 自身の front-matter オブジェクト
- **`specs`** — 全スペックの SpecMeta 配列
- **`category`** — 自身のカテゴリー（文字列）
- **`slug`** — 自身のスラッグ（文字列）

### 組み込みコンポーネント

MDX 内で import 不要で使える組み込みコンポーネント：

- **`<TableDefinition data={data.table} />`** — DB テーブル定義を描画。`data.table` は `{ name, description?, columns: [...] }` 構造
- **`<SpecList category="tables" />`** — カテゴリー内のスペック一覧を表示。category 省略時は自カテゴリー
- **`<DataView data={...} />`** — オブジェクトを折りたたみ可能な JSON ビューとして整形表示
- **`<SpecLink to="tables:users">...</SpecLink>`** — wiki リンクのコンポーネント版
- **`<Drawing src="screens/login" />`** — Excalidraw のワイヤーフレームを埋め込み。ホバーで編集ボタン、クリックでフルスクリーン編集モーダル

### 使用例

```markdown
---
title: users テーブル
table:
  name: users
  columns:
    - { name: id, type: bigint, primaryKey: true }
    - { name: email, type: varchar(255), nullable: false }
---

# {title}

ユーザー情報を管理するテーブルです。

<TableDefinition data={data.table} />

## 関連スペック

[[tables:posts]] で投稿テーブルを参照しています。
```

### フォーム編集

エディターの [テキスト] / [フォーム] タブを切り替えることで、YAML front-matter を GUI フォームで編集できます。
スキーマの `title` がフォーム項目のラベル、`description` がヘルプテキストとして表示されます。
`enum` が定義されている項目はドロップダウンになります。
カテゴリーに `_schema.json` が無い場合でも、既存データから型を自動推論してフォームを生成します。
ただし、フォーム編集時は YAML のコメントや独自の整形は正規化されることをご注意ください。

## wiki リンク

スペック間の関連性を表現するため、`[[category:slug]]` 形式の wiki リンクを使用します。

### リンク記法

```markdown
[[tables:users]]                    # specs/tables/users.mdx へのリンク
[[tables:users|ユーザー]]            # 表示テキストを指定
[[api:v1:users-api]]                # ネストされたカテゴリーもサポート
[[tables:_]]                        # カテゴリーインデックスへのリンクも可
```

### グラフページ

すべてのスペックと wiki リンクを自動的に抽出し、グラフページ (`/graph`) でリンクネットワークを可視化します。

- **ドラッグ可能** — ノードをドラッグして位置調整
- **カテゴリー別色分け** — 視覚的にカテゴリーを区別
- **クリックで遷移** — ノードをクリックするとそのスペックへ移動
- **欠損ノード** — リンク先が存在しないスペックは破線で表示

## REST API

specifian サーバーが提供する API。すべてのパスはベース URL（例: `http://localhost:4400`）に相対。

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/specs` | 全スペック SpecMeta 一覧（`_template` 除く） |
| `GET` | `/api/specs/<category>/<slug>` | スペック 1 件取得（メタデータ + 生テキスト） |
| `PUT` | `/api/specs/<category>/<slug>` | スペック保存（body: `{ content: string }` ） |
| `POST` | `/api/specs` | スペック新規作成（body: `{ category, slug, title? }` ） |
| `POST` | `/api/categories` | カテゴリー新規作成（body: `{ path }` ） |
| `GET` | `/api/data` | 全スペックの front-matter データ（カテゴリー別） |
| `GET` | `/api/data/<category>` | 特定カテゴリーの front-matter データ |
| `GET` | `/api/graph` | wiki リンク構築のグラフデータ（ノード・エッジ） |
| `GET` | `/api/generators` | 利用可能なコード生成テンプレート名一覧 |
| `POST` | `/api/generate` | コード生成（body: `{ generator, specId?, out? }` ） |
| `GET` | `/api/drawings` | 全 Excalidraw ファイルの一覧 |
| `GET` | `/api/drawings/<path>` | Excalidraw シーン JSON 取得（path は拡張子なし） |
| `PUT` | `/api/drawings/<path>` | Excalidraw シーン JSON 保存 |
| `WS` | `/ws` | WebSocket。ファイル変更イベントをブロードキャスト |

### エラーレスポンス

すべてのエラーは `{ error: string }` 形式で、適切な HTTP ステータスコード付き。

```json
{
  "error": "Spec not found"
}
```

## MCP サーバー

specifian は MCP (Model Context Protocol) サーバーを内蔵しており、AI エージェント (Claude Code など) が
スペックドキュメントを安全に読み書きできます。stdio トランスポートで動作します。

### 起動

```bash
specifian mcp --dir ./specs
```

> stdout は MCP プロトコル (JSON-RPC) が占有するため、ログはすべて stderr に出力されます。

### Claude Code への登録例

`.mcp.json`（または Claude Code の MCP 設定）に以下を追加します。

```json
{
  "mcpServers": {
    "specifian": {
      "command": "npx",
      "args": ["specifian", "mcp", "--dir", "./specs"]
    }
  }
}
```

### 提供ツール

スペック ID はすべて `"category:slug"` 形式（インデックスは `tables:_`）。`content` は front-matter を含む MDX 全文です。

| ツール | 説明 |
|---|---|
| `list_specs` | 全スペックのメタ情報 (SpecMeta[]) を返す（`_template` 除く） |
| `read_spec` | `{ id }` → `{ meta, content }`。存在しなければエラー |
| `write_spec` | `{ id, content }` で既存スペックを上書き保存し `{ meta, issues }` を返す |
| `create_spec` | `{ category, slug, title? }` で新規作成。`_template.mdx` があればコピー |
| `rename_spec` | `{ from, to }` でリネーム＋wiki リンク一括書き換え。`{ meta, rewrittenFiles }` |
| `delete_spec` | `{ id }` で削除。`{ ok, brokenRefs }` で壊れた参照を通知 |
| `get_refs` | `{ id }` → `{ refs }`。id を参照しているスペック ID 一覧 |
| `search` | `{ query, limit? }` → SearchResult[]。全文検索 |
| `get_data` | `{ category? }` → front-matter データ map |
| `validate` | front-matter を `_schema.json` で検証し ValidationReport を返す |
| `lint` | `{ content, category?, slug? }` で保存せず検証し `{ issues }` を返す |
| `list_generators` | 利用可能なコード生成テンプレート名一覧 (string[]) |
| `generate` | `{ generator, specId?, out? }` でコード生成。`{ files }` を返す |

## 開発

### 開発モード起動

```bash
npm run dev
```

- サーバー（port 4399） + Vite 開発サーバー（port 5180）を同時起動
- クライアント側は Vite で `/api` と `/ws` を localhost:4399 へプロキシ
- `examples/specs` をサンプルディレクトリーとして使用

### ビルド

```bash
npm run build
```

- `tsup` で CLI・サーバーを `dist/` へビルド
- `vite build` でクライアントを `dist/client/` へビルド

### 起動（ビルド後）

```bash
npm start
```

例：`examples/specs` で本番ビルドの specifian を起動します。

## テクノロジースタック

| 領域 | 技術 |
|---|---|
| 言語 | TypeScript (strict mode), ESM |
| CLI | commander |
| サーバー | Express 4 + WebSocket (ws) + ファイル監視 (chokidar) + YAML 解析 (gray-matter) |
| クライアント | React 18 + React Router 6 + Vite 8 |
| MDX | @mdx-js/mdx v3 + remark プラグイン |
| エディター | @uiw/react-codemirror |
| グラフ可視化 | d3-force |
| コード生成 | @scaffdog/engine |

Node.js >= 20 が必須。Windows 対応済み。

## License

MIT
