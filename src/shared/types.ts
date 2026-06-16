/**
 * specifian shared type definitions — the source of truth for the API contract.
 * Imported by both the server (src/server) and the client (src/client).
 * When changing these, keep docs/DESIGN.md and both implementations in sync.
 */

/** Metadata for a single file (.mdx) inside the specs directory */
export interface SpecMeta {
  /** "tables:users", "api/v1:users"; index is "tables:_" */
  id: string;
  /** "tables", "api/v1" — always "/"-separated */
  category: string;
  /** File name (without extension). Index is "_" */
  slug: string;
  /** specsDir-relative path "tables/users.mdx" — always "/"-separated */
  path: string;
  /** frontmatter.title ?? slug */
  title: string;
  description?: string;
  /** The entire front-matter */
  data: Record<string, unknown>;
  /** Wiki link target IDs found in the body ("tables:users" form). Deduplicated */
  links: string[];
  /** slug === "_" */
  isIndex: boolean;
}

/** Response for GET /api/specs/<category>/<slug> */
export interface SpecDetail {
  meta: SpecMeta;
  /** Raw MDX text including the front-matter */
  content: string;
}

/** Request body for PUT /api/specs/... */
export interface SaveSpecRequest {
  content: string;
}

/** Request body for POST /api/specs */
export interface CreateSpecRequest {
  category: string;
  slug: string;
  title?: string;
}

/** Request body for POST /api/categories */
export interface CreateCategoryRequest {
  /** specsDir-relative path such as "tables", "api/v1" */
  path: string;
}

/** Response for GET /api/data: data[category][slug] = front-matter */
export type AllData = Record<string, Record<string, Record<string, unknown>>>;

/** Response for GET /api/graph */
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  /** SpecMeta.id */
  id: string;
  title: string;
  category: string;
  /** true when the link target does not exist (placeholder node) */
  missing?: boolean;
}

export interface GraphEdge {
  /** SpecMeta.id */
  source: string;
  /** SpecMeta.id */
  target: string;
}

/** Request body for POST /api/generate */
export interface GenerateRequest {
  /** specs/_generators/<generator>.md */
  generator: string;
  /** Target spec ID. When omitted, all specs */
  specId?: string;
  /** Output directory (relative to the server cwd). When omitted, nothing is written and only the response is returned */
  out?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerateResponse {
  files: GeneratedFile[];
}

/** WebSocket (/ws) broadcast message */
export interface FsEvent {
  type: 'fs';
  event: 'add' | 'change' | 'unlink';
  /** SpecMeta.id of the changed file (null for non-mdx files or _generators) */
  specId: string | null;
  /** specsDir-relative path ("/"-separated) */
  path: string;
}

/** API error response */
export interface ApiError {
  error: string;
}

/** A single result for GET /api/search?q=&limit= */
export interface SearchResult {
  id: string;
  title: string;
  category: string;
  slug: string;
  /** Excerpt around the match (includes surrounding context) */
  snippet: string;
  /** The field that matched (by score: title > description > data > body) */
  field: 'title' | 'description' | 'data' | 'body';
}

/** A single schema violation */
export interface ValidationIssue {
  specId: string;
  /** Data path (e.g. "/table/columns/0/type") */
  path: string;
  message: string;
}

/** Response for GET /api/validation. Covers only categories that have a _schema.json */
export interface ValidationReport {
  issues: ValidationIssue[];
}

/** A single result for GET /api/components (user-defined components under specs/_components/) */
export interface UserComponentFile {
  /** specsDir-relative path "_components/StatusBadge.tsx" */
  path: string;
  source: string;
}

/** A single result for GET /api/drawings (Excalidraw drawings under specs) */
export interface DrawingMeta {
  /** specsDir-relative path "screens/login.excalidraw" ("/"-separated) */
  path: string;
}

/** Request for POST /api/lint (validates without saving) */
export interface LintRequest {
  /** Full MDX text including front-matter */
  content: string;
  /** Category used for schema validation (when omitted, schema validation is skipped) */
  category?: string;
  slug?: string;
}

/** A single lint / save-time validation result */
export interface LintIssue {
  severity: 'error' | 'warning';
  rule: 'mdx' | 'yaml' | 'wikilink' | 'schema';
  message: string;
  /** 1-based (only when known) */
  line?: number;
  column?: number;
}

/** Response for POST /api/lint */
export interface LintResponse {
  issues: LintIssue[];
}

/** Response for PUT /api/specs/... (the save always runs; issues are informational) */
export interface SaveSpecResponse {
  meta: SpecMeta;
  issues: LintIssue[];
}

/** Request for POST /api/rename (from/to are spec IDs "category:slug") */
export interface RenameSpecRequest {
  from: string;
  to: string;
}

/** Response for POST /api/rename */
export interface RenameSpecResponse {
  meta: SpecMeta;
  /** IDs of specs whose wiki links were rewritten */
  rewrittenFiles: string[];
}

/** Response for GET /api/refs?id=<specId> */
export interface RefsResponse {
  /** IDs of specs that reference id via a wiki link */
  refs: string[];
}

/** Response for GET /api/schema/<category>. Categories without a _schema.json get schema: null */
export interface CategorySchemaResponse {
  schema: Record<string, unknown> | null;
}

/**
 * Response for GET /api/guide/<category>. The category root (empty path) holds the
 * project-wide guide. Categories/root without a _guide.md get guide: null.
 * `guide` is the raw Markdown including front-matter; title/description are parsed from it.
 */
export interface GuideResponse {
  guide: string | null;
  title?: string;
  description?: string;
}

/** Request body for PUT /api/guide/<category> */
export interface SaveGuideRequest {
  content: string;
}

/** Regex for extracting wiki links (excluding code fences/inline code is done by the caller) */
export const WIKILINK_PATTERN = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** id "tables:users" -> { category: "tables", slug: "users" }. Returns null for invalid forms */
export function parseSpecId(id: string): { category: string; slug: string } | null {
  const idx = id.lastIndexOf(':');
  if (idx <= 0 || idx === id.length - 1) return null;
  return { category: id.slice(0, idx), slug: id.slice(idx + 1) };
}

/** category + slug -> id */
export function toSpecId(category: string, slug: string): string {
  return `${category}:${slug}`;
}

/** id -> client route "/specs/tables/users" */
export function specRoute(id: string): string {
  const parsed = parseSpecId(id);
  if (!parsed) return '/';
  return `/specs/${parsed.category}/${parsed.slug}`;
}
