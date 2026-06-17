/**
 * Static export — write a read-only snapshot of a specs directory as a fully
 * static site (no server required at runtime).
 *
 * It does NOT rebuild the client (vite and the client deps are devDependencies
 * and the published package ships only the prebuilt dist/client). Instead it:
 *   1. copies the prebuilt client (dist/client) into outDir,
 *   2. injects a marker (window.__SPECIFIAN_STATIC__) so the same bundle runs in
 *      read-only static mode, and adds a 404.html fallback,
 *   3. bakes every GET API response into JSON files under outDir/data/.
 *
 * The client (api.ts) reads those JSON files via relative paths, so the snapshot
 * works at any mount path (root or a GitHub Pages subpath) without configuration.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecs } from './store.js';
import { buildGraph } from './routes/graph.js';
import { loadUserComponents } from './routes/components.js';
import { scanExcalidraw } from './routes/drawings.js';
import { loadGuide } from './guide.js';
import { loadCategorySchema, validateSpecs } from './validate.js';
import { buildSearchEntries } from './searchCore.js';
import type {
  AllData,
  CategorySchemaResponse,
  GuideResponse,
  SpecDetail,
} from '../shared/types.js';

const STATIC_MARKER = '<script>window.__SPECIFIAN_STATIC__=true;</script>';

export interface ExportOptions {
  /** Absolute path to the specs directory */
  specsDir: string;
  /** Absolute path to the output directory (created/emptied) */
  outDir: string;
  /** Optional logger (defaults to console.log) */
  log?: (msg: string) => void;
}

/** Locate the prebuilt client (always <packageRoot>/dist/client). */
async function findClientDir(): Promise<string> {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    try {
      await fs.access(path.join(dir, 'package.json'));
      return path.join(dir, 'dist', 'client');
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  // Fallback: sibling of the compiled CLI (dist/cli -> dist/client)
  return fileURLToPath(new URL('../client', import.meta.url));
}

/** Write `data` as JSON to outDir/<relPath> (relPath is "/"-separated). */
async function writeJson(
  outDir: string,
  relPath: string,
  data: unknown,
): Promise<void> {
  const target = path.join(outDir, ...relPath.split('/'));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data), 'utf-8');
}

/** Static file key for a category ('' root → '_root'). Mirrors api.ts catKey(). */
function catKey(category: string): string {
  return category === '' ? '_root' : category;
}

/**
 * All categories the client may request schema/guide for: every category plus
 * its ancestor prefixes, plus the root (''). Each gets a file so a missing
 * schema/guide returns `{ schema: null }` / `{ guide: null }` (matching the live
 * API) instead of a 404.
 */
function categoryClosure(categories: Iterable<string>): Set<string> {
  const set = new Set<string>(['']);
  for (const cat of categories) {
    if (!cat) continue;
    const parts = cat.split('/');
    for (let i = 1; i <= parts.length; i++) {
      set.add(parts.slice(0, i).join('/'));
    }
  }
  return set;
}

export async function exportStatic(opts: ExportOptions): Promise<void> {
  const { specsDir, outDir } = opts;
  const log = opts.log ?? ((m: string) => console.log(m));

  // ── Resolve & verify the prebuilt client ─────────────────────────
  const clientDir = await findClientDir();
  try {
    await fs.access(path.join(clientDir, 'index.html'));
  } catch {
    throw new Error(
      `Client build not found at ${clientDir}. Run "npm run build" first.`,
    );
  }

  // ── 1. Copy the prebuilt client into a clean outDir ──────────────
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.cp(clientDir, outDir, { recursive: true });
  log(`📦 Copied client → ${outDir}`);

  // ── 2. Inject the static marker + 404 fallback ───────────────────
  const indexPath = path.join(outDir, 'index.html');
  let html = await fs.readFile(indexPath, 'utf-8');
  if (!html.includes('__SPECIFIAN_STATIC__')) {
    html = html.includes('<head>')
      ? html.replace('<head>', `<head>\n    ${STATIC_MARKER}`)
      : STATIC_MARKER + html;
  }
  await fs.writeFile(indexPath, html, 'utf-8');
  await fs.writeFile(path.join(outDir, '404.html'), html, 'utf-8');

  // ── 3. Bake the data ─────────────────────────────────────────────
  const specs = await loadSpecs(specsDir);
  const navSpecs = specs.filter((s) => s.slug !== '_template');

  // specs.json (GET /api/specs)
  await writeJson(outDir, 'data/specs.json', navSpecs);

  // spec/<path>.json (GET /api/specs/<path>) + accumulate data.json
  const allData: AllData = {};
  for (const spec of navSpecs) {
    const absPath = path.join(specsDir, ...spec.path.split('/'));
    let content: string;
    try {
      content = await fs.readFile(absPath, 'utf-8');
    } catch {
      continue; // Unreadable file: skip
    }
    const detail: SpecDetail = { meta: spec, content };
    const rel = spec.category ? `${spec.category}/${spec.slug}` : spec.slug;
    await writeJson(outDir, `data/spec/${rel}.json`, detail);

    if (!allData[spec.category]) allData[spec.category] = {};
    allData[spec.category][spec.slug] = spec.data;
  }

  // data.json (GET /api/data)
  await writeJson(outDir, 'data/data.json', allData);

  // graph.json (GET /api/graph)
  await writeJson(outDir, 'data/graph.json', buildGraph(specs));

  // components.json (GET /api/components)
  await writeJson(outDir, 'data/components.json', await loadUserComponents(specsDir));

  // validation.json (GET /api/validation)
  await writeJson(outDir, 'data/validation.json', await validateSpecs(specsDir));

  // search-index.json (client-side full-text search)
  await writeJson(outDir, 'data/search-index.json', await buildSearchEntries(specsDir));

  // schema/<key>.json + guide/<key>.json for every category (incl. ancestors + root)
  const categories = categoryClosure(navSpecs.map((s) => s.category));
  for (const cat of categories) {
    const schemaResult = await loadCategorySchema(specsDir, cat);
    const schemaBody: CategorySchemaResponse = { schema: schemaResult.schema };
    await writeJson(outDir, `data/schema/${catKey(cat)}.json`, schemaBody);

    const guideResult = await loadGuide(specsDir, cat);
    const guideBody: GuideResponse = {
      guide: guideResult.guide,
      title: guideResult.title,
      description: guideResult.description,
    };
    await writeJson(outDir, `data/guide/${catKey(cat)}.json`, guideBody);
  }

  // drawings.json (GET /api/drawings) + drawings/<path>.json (GET /api/drawings/<path>)
  const drawings = (await scanExcalidraw(specsDir, specsDir)).sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  await writeJson(outDir, 'data/drawings.json', drawings);
  for (const d of drawings) {
    const abs = path.join(specsDir, ...d.path.split('/'));
    let raw: string;
    try {
      raw = await fs.readFile(abs, 'utf-8');
    } catch {
      continue;
    }
    // The client requests drawings without the .excalidraw extension.
    // The file content is already scene JSON — write it as-is under .json.
    const rel = d.path.replace(/\.excalidraw$/, '');
    const target = path.join(outDir, 'data', 'drawings', ...rel.split('/')) + '.json';
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, raw, 'utf-8');
  }

  log(
    `🗂  Wrote data: ${navSpecs.length} specs, ${drawings.length} drawings, ${categories.size} categories`,
  );
}
