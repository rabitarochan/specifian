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
      // A prefix match would also proxy /api.ts (the module URL for
      // src/client/api.ts), so use regex keys to limit it to API paths only
      '^/api/': 'http://localhost:4399',
      '^/ws$': { target: 'ws://localhost:4399', ws: true },
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
});
