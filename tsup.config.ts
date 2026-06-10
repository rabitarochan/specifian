import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'cli/index': 'src/cli/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: false,
  banner: { js: '#!/usr/bin/env node' },
  // ESM bundle 内で require を使う CJS 依存対策
  shims: true,
});
