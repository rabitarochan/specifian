/**
 * Typed fetch wrapper. Implements the API contract defined in docs/DESIGN.md.
 * All requests use relative paths (`/api/...`) — Vite dev proxies /api to the server.
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
  SaveSpecResponse,
  RenameSpecResponse,
  RefsResponse,
} from '@shared/types';

/** Error thrown when the API returns 404; callers can identify it by type. */
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
      // Non-JSON response: keep the status text as the message
    }
    throw new ApiHttpError(res.status, message);
  }
  // Bodyless responses (e.g. 204) are not expected, but guard just in case
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** GET /api/specs — all SpecMeta */
export function fetchSpecs(): Promise<SpecMeta[]> {
  return request<SpecMeta[]>('/api/specs');
}

/** Joins category + slug into a path (root category is empty string, so avoid double slashes). */
function specPath(category: string, slug: string): string {
  return category ? `${category}/${slug}` : slug;
}

/** GET /api/specs/<category>/<slug> — fetch a single spec */
export function fetchSpec(category: string, slug: string): Promise<SpecDetail> {
  return request<SpecDetail>(`/api/specs/${specPath(category, slug)}`);
}

/** GET /api/specs/<path...> — fetch using the splat path as-is */
export function fetchSpecByPath(path: string): Promise<SpecDetail> {
  return request<SpecDetail>(`/api/specs/${path}`);
}

/** PUT /api/specs/<category>/<slug> — save. issues are informational (save always proceeds). */
export function saveSpec(
  category: string,
  slug: string,
  content: string,
): Promise<SaveSpecResponse> {
  return request<SaveSpecResponse>(`/api/specs/${specPath(category, slug)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/** POST /api/rename — rename a spec ID (from/to are "category:slug") */
export function renameSpecId(from: string, to: string): Promise<RenameSpecResponse> {
  return request<RenameSpecResponse>('/api/rename', {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });
}

/** DELETE /api/specs/<categoryPath>/<slug> — delete a spec */
export function deleteSpecById(category: string, slug: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/specs/${specPath(category, slug)}`, {
    method: 'DELETE',
  });
}

/** GET /api/refs?id=<specId> — list of spec IDs that reference the given id */
export function fetchRefs(id: string): Promise<RefsResponse> {
  const params = new URLSearchParams({ id });
  return request<RefsResponse>(`/api/refs?${params.toString()}`);
}

/** POST /api/specs — create a new spec */
export function createSpec(
  body: CreateSpecRequest,
): Promise<{ meta: SpecMeta }> {
  return request<{ meta: SpecMeta }>('/api/specs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/categories — create a new category */
export function createCategory(body: CreateCategoryRequest): Promise<void> {
  return request<void>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** GET /api/data — all front-matter */
export function fetchAllData(): Promise<AllData> {
  return request<AllData>('/api/data');
}

/** GET /api/data/<category> — front-matter for a category */
export function fetchCategoryData(
  category: string,
): Promise<Record<string, Record<string, unknown>>> {
  return request<Record<string, Record<string, unknown>>>(
    `/api/data/${category}`,
  );
}

/** GET /api/graph — link graph */
export function fetchGraph(): Promise<Graph> {
  return request<Graph>('/api/graph');
}

/** GET /api/generators — list of generator names */
export function fetchGenerators(): Promise<string[]> {
  return request<string[]>('/api/generators');
}

/** POST /api/generate — code generation */
export function generate(body: GenerateRequest): Promise<GenerateResponse> {
  return request<GenerateResponse>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** GET /api/search?q=&limit= — full-text search. Returns [] immediately when q is empty. */
export function searchSpecs(q: string, limit = 20): Promise<SearchResult[]> {
  if (!q.trim()) return Promise.resolve([]);
  const params = new URLSearchParams({ q, limit: String(limit) });
  return request<SearchResult[]>(`/api/search?${params.toString()}`);
}

/** GET /api/validation — list of front-matter schema violations */
export function fetchValidation(): Promise<ValidationReport> {
  return request<ValidationReport>('/api/validation');
}

/** GET /api/schema/<category> — _schema.json for the category (schema: null if none) */
export function fetchCategorySchema(
  category: string,
): Promise<CategorySchemaResponse> {
  return request<CategorySchemaResponse>(`/api/schema/${category}`);
}

/** GET /api/drawings/<path> — fetch an Excalidraw scene JSON (path without extension; 404 throws ApiHttpError) */
export function fetchDrawing(path: string): Promise<unknown> {
  return request<unknown>(`/api/drawings/${path}`);
}

/** PUT /api/drawings/<path> — save an Excalidraw scene JSON (also creates new drawings) */
export function saveDrawing(
  path: string,
  scene: unknown,
): Promise<DrawingMeta> {
  return request<DrawingMeta>(`/api/drawings/${path}`, {
    method: 'PUT',
    body: JSON.stringify(scene),
  });
}
