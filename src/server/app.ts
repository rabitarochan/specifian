import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { specsRouter } from './routes/specs.js';
import { categoriesRouter } from './routes/categories.js';
import { dataRouter } from './routes/data.js';
import { graphRouter } from './routes/graph.js';
import { generatorsRouter, generateRouter } from './routes/generators.js';
import { searchRouter } from './routes/search.js';
import { componentsRouter } from './routes/components.js';
import { validationRouter } from './routes/validation.js';
import { startWatcher } from './watcher.js';

export interface ServerOptions {
  specsDir: string;
  port: number;
}

export interface SpecbookServer {
  server: http.Server;
  close: () => void;
}

export function createServer(options: ServerOptions): SpecbookServer {
  const { specsDir } = options;

  const app = express();
  app.use(express.json());

  // API routes — exact paths before wildcards
  app.use('/api/specs', specsRouter(specsDir));
  app.use('/api/categories', categoriesRouter(specsDir));
  app.use('/api/data', dataRouter(specsDir));
  app.use('/api/graph', graphRouter(specsDir));
  app.use('/api/generators', generatorsRouter(specsDir));
  app.use('/api/generate', generateRouter(specsDir));
  app.use('/api/search', searchRouter(specsDir));
  app.use('/api/components', componentsRouter(specsDir));
  app.use('/api/validation', validationRouter(specsDir));

  // Static client
  // Compiled dist layout: dist/cli/index.js -> dist/client (sibling of cli/)
  const clientDir = fileURLToPath(new URL('../client', import.meta.url));
  const indexHtml = path.join(clientDir, 'index.html');
  const clientExists = fs.existsSync(clientDir);

  if (clientExists) {
    app.use(express.static(clientDir));
  }

  // SPA fallback (and 503 when no build)
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => {
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res
        .status(503)
        .send(
          'クライアントのビルドが見つかりません。npm run build を実行してください。',
        );
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const stopWatcher = startWatcher(specsDir, wss);

  const close = () => {
    stopWatcher();
    wss.close();
    server.close();
  };

  return { server, close };
}

export function startServer(options: ServerOptions): Promise<SpecbookServer> {
  return new Promise((resolve, reject) => {
    let srv: SpecbookServer;
    try {
      srv = createServer(options);
    } catch (err) {
      reject(err);
      return;
    }
    srv.server.listen(options.port, () => {
      resolve(srv);
    });
    srv.server.on('error', reject);
  });
}
