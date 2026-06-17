/**
 * Typed fetch wrapper. Implements the API contract defined in docs/DESIGN.md.
 *
 * Two modes (selected at runtime — see env.ts):
 * - Dynamic (default): all requests use relative paths (`/api/...`); Vite dev
 *   proxies /api to the server, and `specifian serve` handles them.
 * - Static: GET requests read pre-generated JSON under `data/` and write
 *   operations are disabled (read-only snapshot produced by `specifian export`).
 */
import type {
  SpecMeta,
  SpecDetail,
  CreateSpecRequest,
  CreateCategoryRequest,
  SaveCategorySettingsRequest,
  AllData,
  Graph,
  GenerateRequest,
  GenerateResponse,
  SearchResult,
  ValidationReport,
  CategorySchemaResponse,
  GuideResponse,
  DrawingMeta,
  ApiError,
  SaveSpecResponse,
  RenameSpecResponse,
  RefsResponse,
} from '@shared/types';
import { searchIndex, type SearchIndexEntry } from '@shared/searchEngine';
import { STATIC, dataUrl } from './env';

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

/** Static snapshots are read-only: write operations throw this. */
function staticWriteError(): never {
  throw new Error('This is a read-only static site; editing is disabled.');
}

/** Map a category to its static file key ('' root → '_root'). */
function catKey(category: string): string {
  return category === '' ? '_root' : category;
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
  return request<SpecMeta[]>(STATIC ? dataUrl('specs.json') : '/api/specs');
}

/** Joins category + slug into a path (root category is empty string, so avoid double slashes). */
function specPath(category: string, slug: string): string {
  return category ? `${category}/${slug}` : slug;
}

/** GET /api/specs/<category>/<slug> — fetch a single spec */
export function fetchSpec(category: string, slug: string): Promise<SpecDetail> {
  return fetchSpecByPath(specPath(category, slug));
}

/** GET /api/specs/<path...> — fetch using the splat path as-is */
export function fetchSpecByPath(path: string): Promise<SpecDetail> {
  return request<SpecDetail>(
    STATIC ? dataUrl(`spec/${path}.json`) : `/api/specs/${path}`,
  );
}

/** PUT /api/specs/<category>/<slug> — save. issues are informational (save always proceeds). */
export function saveSpec(
  category: string,
  slug: string,
  content: string,
): Promise<SaveSpecResponse> {
  if (STATIC) return staticWriteError();
  return request<SaveSpecResponse>(`/api/specs/${specPath(category, slug)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/** POST /api/rename — rename a spec ID (from/to are "category:slug") */
export function renameSpecId(from: string, to: string): Promise<RenameSpecResponse> {
  if (STATIC) return staticWriteError();
  return request<RenameSpecResponse>('/api/rename', {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });
}

/** DELETE /api/specs/<categoryPath>/<slug> — delete a spec */
export function deleteSpecById(category: string, slug: string): Promise<{ ok: true }> {
  if (STATIC) return staticWriteError();
  return request<{ ok: true }>(`/api/specs/${specPath(category, slug)}`, {
    method: 'DELETE',
  });
}

/** GET /api/refs?id=<specId> — list of spec IDs that reference the given id */
export function fetchRefs(id: string): Promise<RefsResponse> {
  // Refs are only needed by the delete dialog, which is hidden in static mode.
  if (STATIC) return Promise.resolve({ refs: [] });
  const params = new URLSearchParams({ id });
  return request<RefsResponse>(`/api/refs?${params.toString()}`);
}

/** POST /api/specs — create a new spec */
export function createSpec(
  body: CreateSpecRequest,
): Promise<{ meta: SpecMeta }> {
  if (STATIC) return staticWriteError();
  return request<{ meta: SpecMeta }>('/api/specs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/categories — create a new category */
export function createCategory(body: CreateCategoryRequest): Promise<void> {
  if (STATIC) return staticWriteError();
  return request<void>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT /api/categories/<category> — merge icon/color into the category index
 * (_.mdx) front-matter. Root category uses the empty path. Returns the updated SpecMeta.
 */
export function saveCategorySettings(
  category: string,
  body: SaveCategorySettingsRequest,
): Promise<SpecMeta> {
  if (STATIC) return staticWriteError();
  return request<SpecMeta>(`/api/categories/${category}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** GET /api/data — all front-matter */
export function fetchAllData(): Promise<AllData> {
  return request<AllData>(STATIC ? dataUrl('data.json') : '/api/data');
}

/** GET /api/data/<category> — front-matter for a category */
export function fetchCategoryData(
  category: string,
): Promise<Record<string, Record<string, unknown>>> {
  if (STATIC) {
    return fetchAllData().then((all) => all[category] ?? {});
  }
  return request<Record<string, Record<string, unknown>>>(
    `/api/data/${category}`,
  );
}

/** GET /api/graph — link graph */
export function fetchGraph(): Promise<Graph> {
  return request<Graph>(STATIC ? dataUrl('graph.json') : '/api/graph');
}

/** GET /api/generators — list of generator names */
export function fetchGenerators(): Promise<string[]> {
  // Code generation requires the server; no generators in a static snapshot.
  if (STATIC) return Promise.resolve([]);
  return request<string[]>('/api/generators');
}

/** POST /api/generate — code generation */
export function generate(body: GenerateRequest): Promise<GenerateResponse> {
  if (STATIC) return staticWriteError();
  return request<GenerateResponse>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Lazily fetched, memoized search index (static mode only). */
let searchIndexPromise: Promise<SearchIndexEntry[]> | null = null;
function loadSearchIndex(): Promise<SearchIndexEntry[]> {
  if (!searchIndexPromise) {
    searchIndexPromise = request<SearchIndexEntry[]>(dataUrl('search-index.json'));
  }
  return searchIndexPromise;
}

/** GET /api/search?q=&limit= — full-text search. Returns [] immediately when q is empty. */
export function searchSpecs(q: string, limit = 20): Promise<SearchResult[]> {
  if (!q.trim()) return Promise.resolve([]);
  if (STATIC) {
    return loadSearchIndex().then((entries) => searchIndex(entries, q, limit));
  }
  const params = new URLSearchParams({ q, limit: String(limit) });
  return request<SearchResult[]>(`/api/search?${params.toString()}`);
}

/** GET /api/validation — list of front-matter schema violations */
export function fetchValidation(): Promise<ValidationReport> {
  return request<ValidationReport>(
    STATIC ? dataUrl('validation.json') : '/api/validation',
  );
}

/** GET /api/schema/<category> — _schema.json for the category (schema: null if none) */
export function fetchCategorySchema(
  category: string,
): Promise<CategorySchemaResponse> {
  return request<CategorySchemaResponse>(
    STATIC ? dataUrl(`schema/${catKey(category)}.json`) : `/api/schema/${category}`,
  );
}

/** GET /api/guide/<category> — _guide.md for the category (root = empty category; guide: null if none) */
export function fetchGuide(category: string): Promise<GuideResponse> {
  return request<GuideResponse>(
    STATIC ? dataUrl(`guide/${catKey(category)}.json`) : `/api/guide/${category}`,
  );
}

/** PUT /api/guide/<category> — save (also creates a new _guide.md) */
export function saveGuide(
  category: string,
  content: string,
): Promise<GuideResponse> {
  if (STATIC) return staticWriteError();
  return request<GuideResponse>(`/api/guide/${category}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/** GET /api/drawings/<path> — fetch an Excalidraw scene JSON (path without extension; 404 throws ApiHttpError) */
export function fetchDrawing(path: string): Promise<unknown> {
  return request<unknown>(
    STATIC ? dataUrl(`drawings/${path}.json`) : `/api/drawings/${path}`,
  );
}

/** PUT /api/drawings/<path> — save an Excalidraw scene JSON (also creates new drawings) */
export function saveDrawing(
  path: string,
  scene: unknown,
): Promise<DrawingMeta> {
  if (STATIC) return staticWriteError();
  return request<DrawingMeta>(`/api/drawings/${path}`, {
    method: 'PUT',
    body: JSON.stringify(scene),
  });
}
