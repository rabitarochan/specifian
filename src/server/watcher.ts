import chokidar from 'chokidar';
import path from 'node:path';
import type { WebSocketServer, WebSocket } from 'ws';
import type { FsEvent } from '../shared/types.js';

function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}

function pathToSpecId(specsDir: string, filePath: string): string | null {
  const rel = normalizePath(path.relative(specsDir, filePath));
  if (rel.startsWith('_generators/')) return null;
  if (!/\.mdx?$/.test(rel)) return null;

  const parts = rel.split('/');
  const filename = parts[parts.length - 1];
  const slug = filename.replace(/\.mdx?$/, '');
  const category = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  return category === '' ? slug : `${category}:${slug}`;
}

function broadcast(wss: WebSocketServer, message: FsEvent): void {
  const data = JSON.stringify(message);
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === 1 /* OPEN */) {
      client.send(data);
    }
  });
}

export function startWatcher(specsDir: string, wss: WebSocketServer): () => void {
  const watcher = chokidar.watch(specsDir, {
    ignoreInitial: true,
    ignored: /(^|[/\\])\../,
    awaitWriteFinish: {
      stabilityThreshold: 150,
      pollInterval: 50,
    },
  });

  function handler(event: 'add' | 'change' | 'unlink') {
    return (filePath: string) => {
      const rel = normalizePath(path.relative(specsDir, filePath));

      // Also notify for user-defined components (_components/*.tsx|jsx) with specId: null.
      const isUserComponent =
        rel.startsWith('_components/') && /\.(tsx|jsx)$/.test(rel);

      // Also notify for Excalidraw drawing files (*.excalidraw) with specId: null.
      const isExcalidraw = rel.endsWith('.excalidraw');

      if (!/\.mdx?$/.test(rel) && !isUserComponent && !isExcalidraw) return;

      const specId = isUserComponent || isExcalidraw ? null : pathToSpecId(specsDir, filePath);
      const msg: FsEvent = {
        type: 'fs',
        event,
        specId,
        path: rel,
      };
      broadcast(wss, msg);
    };
  }

  watcher.on('add', handler('add'));
  watcher.on('change', handler('change'));
  watcher.on('unlink', handler('unlink'));

  return () => {
    watcher.close();
  };
}
