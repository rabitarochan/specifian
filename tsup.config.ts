import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'cli/index': 'src/cli/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: false,
  banner: { js: '#!/usr/bin/env node' },
  // Workaround for CJS dependencies that use require inside the ESM bundle
  shims: true,
});
