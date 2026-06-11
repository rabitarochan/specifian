import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    proxy: {
      // 前方一致だと /api.ts (src/client/api.ts のモジュール URL) まで
      // プロキシされてしまうため、正規表現キーで API パスだけに限定する
      '^/api/': 'http://localhost:4399',
      '^/ws$': { target: 'ws://localhost:4399', ws: true },
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
});
