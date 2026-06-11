import path from 'node:path';
import fs from 'node:fs/promises';
import { Router, json, type Request, type Response } from 'express';
import type { DrawingMeta } from '../../shared/types.js';

function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * パストラバーサルガード。
 * decoded なパス文字列を specsDir 配下に解決し、
 * specsDir の外を指す場合は null を返す。
 */
function resolveGuarded(specsDir: string, relPath: string): string | null {
  const resolvedSpecsDir = path.resolve(specsDir);
  const resolvedTarget = path.resolve(specsDir, ...relPath.split('/'));
  if (
    resolvedTarget !== resolvedSpecsDir &&
    !resolvedTarget.startsWith(resolvedSpecsDir + path.sep)
  ) {
    return null;
  }
  return resolvedTarget;
}

/**
 * specsDir 配下を再帰走査して *.excalidraw ファイルを列挙する。
 * ドットディレクトリー (例: .git) と node_modules は除外。
 */
async function scanExcalidraw(specsDir: string, dir: string): Promise<DrawingMeta[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: DrawingMeta[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const children = await scanExcalidraw(specsDir, abs);
      results.push(...children);
    } else if (entry.isFile() && entry.name.endsWith('.excalidraw')) {
      results.push({
        path: normalizePath(path.relative(specsDir, abs)),
      });
    }
  }
  return results;
}

/**
 * /api/drawings ルーター
 *
 * GET /               → DrawingMeta[] (specsDir 配下の全 .excalidraw、パスは specsDir 相対 "/" 区切り)
 * GET /<path>         → シーン JSON (404 if missing)。<path> は拡張子なし
 * PUT /<path>         → body = シーン JSON を保存 (新規作成可、親ディレクトリーは存在必須)
 *
 * express.json({ limit: '20mb' }) をルーターレベルで適用。
 * Excalidraw シーンは大きくなり得るためアプリ全体の 100 kb 制限を回避する。
 */
export function drawingsRouter(specsDir: string): Router {
  const router = Router();

  // ルーターレベルの body-limit を上書き (シーン JSON は大きい)
  router.use(json({ limit: '20mb' }));

  // ─── GET / (一覧) ────────────────────────────────────────────────
  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
      const drawings = await scanExcalidraw(specsDir, specsDir);
      // 安定したアルファベット順にソート
      drawings.sort((a, b) => a.path.localeCompare(b.path));
      res.json(drawings);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── GET /<path> (1 件取得) ───────────────────────────────────────
  router.get(/^\/.+$/, async (req: Request, res: Response): Promise<void> => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      res.status(400).json({ error: 'URLのデコードに失敗しました' });
      return;
    }

    // 先頭スラッシュを除去
    const relPath = decoded.replace(/^\//, '');

    if (!relPath) {
      res.status(400).json({ error: 'パスが空です' });
      return;
    }

    // パストラバーサルガード
    const resolved = resolveGuarded(specsDir, relPath);
    if (resolved === null) {
      res.status(400).json({ error: 'パストラバーサルは許可されていません' });
      return;
    }

    const filePath = resolved + '.excalidraw';

    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        res.status(404).json({ error: '図が見つかりません' });
        return;
      }
      res.status(500).json({ error: String(err) });
      return;
    }

    res.type('application/json').send(raw);
  });

  // ─── PUT /<path> (保存) ──────────────────────────────────────────
  router.put(/^\/.+$/, async (req: Request, res: Response): Promise<void> => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      res.status(400).json({ error: 'URLのデコードに失敗しました' });
      return;
    }

    // 先頭スラッシュを除去
    const relPath = decoded.replace(/^\//, '');

    if (!relPath) {
      res.status(400).json({ error: 'パスが空です' });
      return;
    }

    // パストラバーサルガード
    const resolved = resolveGuarded(specsDir, relPath);
    if (resolved === null) {
      res.status(400).json({ error: 'パストラバーサルは許可されていません' });
      return;
    }

    // ボディ検証: non-null なオブジェクトであること
    const body = req.body as unknown;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'リクエストボディは JSON オブジェクトである必要があります' });
      return;
    }

    const filePath = resolved + '.excalidraw';

    // 親ディレクトリーの存在確認 (mkdir しない — 図はスペックの隣に置く)
    const parentDir = path.dirname(filePath);
    try {
      await fs.access(parentDir);
    } catch {
      res.status(400).json({ error: `親ディレクトリーが存在しません: ${normalizePath(path.relative(specsDir, parentDir))}` });
      return;
    }

    try {
      const content = JSON.stringify(body, null, 2) + '\n';
      await fs.writeFile(filePath, content, { encoding: 'utf-8' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
      return;
    }

    const meta: DrawingMeta = {
      path: normalizePath(path.relative(specsDir, filePath)),
    };
    res.json(meta);
  });

  return router;
}
