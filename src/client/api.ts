/**
 * 型付き fetch ラッパー。docs/DESIGN.md の API 契約に対応する。
 * すべて相対パス (`/api/...`) を叩く — Vite dev は /api をサーバーへ proxy する。
 */
import type {
  SpecMeta,
  SpecDetail,
  CreateSpecRequest,
  CreateCategoryRequest,
  AllData,
  Graph,
  GenerateRequest,
  GenerateResponse,
  SearchResult,
  ValidationReport,
  CategorySchemaResponse,
  DrawingMeta,
  ApiError,
} from '@shared/types';

/** API が 404 を返したときに投げる、呼び出し側で判別可能なエラー */
export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as ApiError;
      if (body?.error) message = body.error;
    } catch {
      // JSON でないレスポンスはステータス文言のまま
    }
    throw new ApiHttpError(res.status, message);
  }
  // 204 などボディなしは想定しないが念のため
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** GET /api/specs — 全 SpecMeta */
export function fetchSpecs(): Promise<SpecMeta[]> {
  return request<SpecMeta[]>('/api/specs');
}

/** category + slug を結合してパスにする (root はカテゴリーが空文字列なので二重スラッシュを避ける) */
function specPath(category: string, slug: string): string {
  return category ? `${category}/${slug}` : slug;
}

/** GET /api/specs/<category>/<slug> — 1 件取得 */
export function fetchSpec(category: string, slug: string): Promise<SpecDetail> {
  return request<SpecDetail>(`/api/specs/${specPath(category, slug)}`);
}

/** GET /api/specs/<path...> — splat をそのまま渡して取得 */
export function fetchSpecByPath(path: string): Promise<SpecDetail> {
  return request<SpecDetail>(`/api/specs/${path}`);
}

/** PUT /api/specs/<category>/<slug> — 保存 */
export function saveSpec(
  category: string,
  slug: string,
  content: string,
): Promise<{ meta: SpecMeta }> {
  return request<{ meta: SpecMeta }>(`/api/specs/${specPath(category, slug)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/** POST /api/specs — 新規スペック作成 */
export function createSpec(
  body: CreateSpecRequest,
): Promise<{ meta: SpecMeta }> {
  return request<{ meta: SpecMeta }>('/api/specs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/categories — 新規カテゴリー作成 */
export function createCategory(body: CreateCategoryRequest): Promise<void> {
  return request<void>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** GET /api/data — 全 front-matter */
export function fetchAllData(): Promise<AllData> {
  return request<AllData>('/api/data');
}

/** GET /api/data/<category> — カテゴリーの front-matter */
export function fetchCategoryData(
  category: string,
): Promise<Record<string, Record<string, unknown>>> {
  return request<Record<string, Record<string, unknown>>>(
    `/api/data/${category}`,
  );
}

/** GET /api/graph — リンクグラフ */
export function fetchGraph(): Promise<Graph> {
  return request<Graph>('/api/graph');
}

/** GET /api/generators — ジェネレーター名一覧 */
export function fetchGenerators(): Promise<string[]> {
  return request<string[]>('/api/generators');
}

/** POST /api/generate — コード生成 */
export function generate(body: GenerateRequest): Promise<GenerateResponse> {
  return request<GenerateResponse>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** GET /api/search?q=&limit= — 全文検索。q が空なら即 [] を返す */
export function searchSpecs(q: string, limit = 20): Promise<SearchResult[]> {
  if (!q.trim()) return Promise.resolve([]);
  const params = new URLSearchParams({ q, limit: String(limit) });
  return request<SearchResult[]>(`/api/search?${params.toString()}`);
}

/** GET /api/validation — front-matter スキーマ違反一覧 */
export function fetchValidation(): Promise<ValidationReport> {
  return request<ValidationReport>('/api/validation');
}

/** GET /api/schema/<category> — カテゴリーの _schema.json (無ければ schema: null) */
export function fetchCategorySchema(
  category: string,
): Promise<CategorySchemaResponse> {
  return request<CategorySchemaResponse>(`/api/schema/${category}`);
}

/** GET /api/drawings/<path> — Excalidraw シーン JSON を取得 (拡張子なしパス、404 は ApiHttpError) */
export function fetchDrawing(path: string): Promise<unknown> {
  return request<unknown>(`/api/drawings/${path}`);
}

/** PUT /api/drawings/<path> — Excalidraw シーン JSON を保存 (新規作成も可) */
export function saveDrawing(
  path: string,
  scene: unknown,
): Promise<DrawingMeta> {
  return request<DrawingMeta>(`/api/drawings/${path}`, {
    method: 'PUT',
    body: JSON.stringify(scene),
  });
}
