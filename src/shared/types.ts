/**
 * specbook 共有型定義 — API 契約の正。
 * サーバー (src/server) とクライアント (src/client) の両方から import する。
 * 変更する場合は docs/DESIGN.md と両実装の整合を保つこと。
 */

/** specs ディレクトリー内の 1 ファイル (.mdx) のメタ情報 */
export interface SpecMeta {
  /** "tables:users", "api/v1:users", インデックスは "tables:_" */
  id: string;
  /** "tables", "api/v1" — 常に "/" 区切り */
  category: string;
  /** ファイル名 (拡張子なし)。インデックスは "_" */
  slug: string;
  /** specsDir 相対パス "tables/users.mdx" — 常に "/" 区切り */
  path: string;
  /** frontmatter.title ?? slug */
  title: string;
  description?: string;
  /** front-matter 全体 */
  data: Record<string, unknown>;
  /** 本文中の wiki リンク先 ID ("tables:users" 形式)。重複排除済み */
  links: string[];
  /** slug === "_" */
  isIndex: boolean;
}

/** GET /api/specs/<category>/<slug> のレスポンス */
export interface SpecDetail {
  meta: SpecMeta;
  /** front-matter を含む生の MDX テキスト */
  content: string;
}

/** PUT /api/specs/... のリクエストボディ */
export interface SaveSpecRequest {
  content: string;
}

/** POST /api/specs のリクエストボディ */
export interface CreateSpecRequest {
  category: string;
  slug: string;
  title?: string;
}

/** POST /api/categories のリクエストボディ */
export interface CreateCategoryRequest {
  /** "tables", "api/v1" のような specsDir 相対パス */
  path: string;
}

/** GET /api/data のレスポンス: data[category][slug] = front-matter */
export type AllData = Record<string, Record<string, Record<string, unknown>>>;

/** GET /api/graph のレスポンス */
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  /** SpecMeta.id */
  id: string;
  title: string;
  category: string;
  /** リンク先が存在しない場合 true (プレースホルダーノード) */
  missing?: boolean;
}

export interface GraphEdge {
  /** SpecMeta.id */
  source: string;
  /** SpecMeta.id */
  target: string;
}

/** POST /api/generate のリクエストボディ */
export interface GenerateRequest {
  /** specs/_generators/<generator>.md */
  generator: string;
  /** 対象スペック ID。省略時は全スペック */
  specId?: string;
  /** 出力先ディレクトリー (サーバーの cwd 相対)。省略時は書き込まずレスポンスのみ */
  out?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerateResponse {
  files: GeneratedFile[];
}

/** WebSocket (/ws) ブロードキャストメッセージ */
export interface FsEvent {
  type: 'fs';
  event: 'add' | 'change' | 'unlink';
  /** 変更されたファイルの SpecMeta.id (mdx 以外や _generators の場合は null) */
  specId: string | null;
  /** specsDir 相対パス ("/" 区切り) */
  path: string;
}

/** API エラーレスポンス */
export interface ApiError {
  error: string;
}

/** GET /api/search?q=&limit= の 1 件 */
export interface SearchResult {
  id: string;
  title: string;
  category: string;
  slug: string;
  /** マッチ箇所の抜粋 (前後の文脈を含む) */
  snippet: string;
  /** マッチしたフィールド (スコア順: title > description > data > body) */
  field: 'title' | 'description' | 'data' | 'body';
}

/** スキーマ違反 1 件 */
export interface ValidationIssue {
  specId: string;
  /** データパス (例: "/table/columns/0/type") */
  path: string;
  message: string;
}

/** GET /api/validation のレスポンス。_schema.json を持つカテゴリーのみ対象 */
export interface ValidationReport {
  issues: ValidationIssue[];
}

/** GET /api/components の 1 件 (specs/_components/ 配下のユーザー定義コンポーネント) */
export interface UserComponentFile {
  /** specsDir 相対パス "_components/StatusBadge.tsx" */
  path: string;
  source: string;
}

/** GET /api/drawings の 1 件 (specs 配下の Excalidraw 図) */
export interface DrawingMeta {
  /** specsDir 相対パス "screens/login.excalidraw" ("/" 区切り) */
  path: string;
}

/** GET /api/schema/<category> のレスポンス。_schema.json が無いカテゴリーは schema: null */
export interface CategorySchemaResponse {
  schema: Record<string, unknown> | null;
}

/** wiki リンク抽出用正規表現 (コードフェンス/インラインコード内の除外は呼び出し側で行う) */
export const WIKILINK_PATTERN = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** id "tables:users" -> { category: "tables", slug: "users" }。不正な形式は null */
export function parseSpecId(id: string): { category: string; slug: string } | null {
  const idx = id.lastIndexOf(':');
  if (idx <= 0 || idx === id.length - 1) return null;
  return { category: id.slice(0, idx), slug: id.slice(idx + 1) };
}

/** category + slug -> id */
export function toSpecId(category: string, slug: string): string {
  return `${category}:${slug}`;
}

/** id -> クライアントルート "/specs/tables/users" */
export function specRoute(id: string): string {
  const parsed = parseSpecId(id);
  if (!parsed) return '/';
  return `/specs/${parsed.category}/${parsed.slug}`;
}
