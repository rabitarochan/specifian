import fs from 'node:fs';
import path from 'node:path';
import { program } from 'commander';
import { startServer } from '../server/app.js';
import { initSpecs } from '../server/init.js';
import { exportStatic } from '../server/exportStatic.js';
import { loadSpecs } from '../server/store.js';
import { runGenerator } from '../server/generate.js';
import { validateSpecs } from '../server/validate.js';
import { startMcpServer } from '../server/mcp.js';
import { generateAgentsDoc } from '../server/agents.js';

const VERSION = '0.1.0';

program
  .name('specifian')
  .version(VERSION)
  .description('A Storybook-like MDX spec management tool');

// serve command (default)
program
  .command('serve', { isDefault: true })
  .description('Start the spec server')
  .option('--dir <specsDir>', 'Specs directory', './.specs')
  .option('--port <port>', 'Port number', '4400')
  .option('--open', 'Open browser automatically', false)
  .action(async (opts: { dir: string; port: string; open: boolean }) => {
    const specsDir = path.resolve(opts.dir);
    const port = parseInt(opts.port, 10);

    if (!fs.existsSync(specsDir)) {
      console.error(
        `Error: Specs directory not found: ${specsDir}`,
      );
      console.error('Hint: Run specifian init --dir <directory> to initialize.');
      process.exit(1);
    }

    console.log(`\n🗒  Specifian v${VERSION}`);
    console.log(`📂 Specs directory: ${specsDir}`);
    console.log(`🚀 Starting server... http://localhost:${port}\n`);

    try {
      await startServer({ specsDir, port });
      console.log(`✅ Server started: http://localhost:${port}`);

      if (opts.open) {
        const { default: open } = await import('open');
        await open(`http://localhost:${port}`);
      }
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  });

// init command
program
  .command('init')
  .description('Initialize with example specs')
  .option('--dir <specsDir>', 'Target directory', './.specs')
  .action(async (opts: { dir: string }) => {
    const targetDir = path.resolve(opts.dir);
    console.log(`📂 Target directory: ${targetDir}`);
    try {
      await initSpecs(targetDir);
      console.log(`✅ Initialized: ${targetDir}`);
      console.log('Start the server with:');
      console.log(`  specifian serve --dir ${opts.dir}`);
    } catch (err) {
      console.error('Initialization failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// export command — write a read-only static snapshot
program
  .command('export')
  .description('Export a read-only static site (host it on GitHub Pages etc.)')
  .option('--dir <specsDir>', 'Specs directory', './.specs')
  .option('--out <outDir>', 'Output directory', 'dist-static')
  .action(async (opts: { dir: string; out: string }) => {
    const specsDir = path.resolve(opts.dir);
    const outDir = path.resolve(opts.out);

    if (!fs.existsSync(specsDir)) {
      console.error(`Error: Specs directory not found: ${specsDir}`);
      console.error('Hint: Run specifian init --dir <directory> to initialize.');
      process.exit(1);
    }

    console.log(`\n🗒  Specifian v${VERSION} — static export`);
    console.log(`📂 Specs directory: ${specsDir}`);
    console.log(`📤 Output directory: ${outDir}\n`);

    try {
      await exportStatic({ specsDir, outDir });
      console.log(`\n✅ Static site exported to: ${outDir}`);
      console.log('Preview locally with any static server, e.g.:');
      console.log(`  npx serve ${opts.out}`);
    } catch (err) {
      console.error(
        'Static export failed:',
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
  });

// generate command
program
  .command('generate <generator>')
  .description('Run a code generation template')
  .option('--dir <specsDir>', 'Specs directory', './.specs')
  .option('--spec <specId>', 'Target spec ID (defaults to all specs)')
  .option('--out <outDir>', 'Output directory', '.')
  .action(
    async (
      generator: string,
      opts: { dir: string; spec?: string; out: string },
    ) => {
      const specsDir = path.resolve(opts.dir);

      if (!fs.existsSync(specsDir)) {
        console.error(
          `Error: Specs directory not found: ${specsDir}`,
        );
        process.exit(1);
      }

      try {
        const allSpecs = await loadSpecs(specsDir);
        const files = await runGenerator(
          specsDir,
          generator,
          allSpecs,
          opts.spec,
          opts.out,
        );

        if (files.length === 0) {
          console.log('No files generated.');
        } else {
          console.log(`✅ Generated ${files.length} file(s):`);
          for (const f of files) {
            console.log(`  ${f.path}`);
          }
        }
      } catch (err) {
        console.error(
          'Code generation failed:',
          err instanceof Error ? err.message : err,
        );
        process.exit(1);
      }
    },
  );

// validate command
program
  .command('validate')
  .description('Validate front-matter against schemas')
  .option('--dir <specsDir>', 'Specs directory', './.specs')
  .action(async (opts: { dir: string }) => {
    const specsDir = path.resolve(opts.dir);

    if (!fs.existsSync(specsDir)) {
      console.error(
        `Error: Specs directory not found: ${specsDir}`,
      );
      process.exit(1);
    }

    try {
      const report = await validateSpecs(specsDir);

      if (report.issues.length === 0) {
        console.log('✅ All front-matter conforms to the schemas');
        process.exit(0);
      } else {
        console.error(`❌ Found ${report.issues.length} schema violation(s):`);
        for (const issue of report.issues) {
          console.error(`  ${issue.specId} ${issue.path}: ${issue.message}`);
        }
        process.exit(1);
      }
    } catch (err) {
      console.error(
        'Validation failed:',
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
  });

// mcp command
program
  .command('mcp')
  .description('Start the MCP server (stdio) — lets AI agents read and write specs')
  .option('--dir <specsDir>', 'Specs directory', './.specs')
  .action(async (opts: { dir: string }) => {
    const specsDir = path.resolve(opts.dir);

    if (!fs.existsSync(specsDir)) {
      console.error(
        `Error: Specs directory not found: ${specsDir}`,
      );
      console.error('Hint: Run specifian init --dir <directory> to initialize.');
      process.exit(1);
    }

    // Note: stdout is reserved for the MCP protocol — startup notices must go to stderr.
    console.error(`Specifian MCP server (stdio) — specs: ${specsDir}`);

    try {
      await startMcpServer(specsDir);
    } catch (err) {
      console.error(
        'Failed to start MCP server:',
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
  });

// agents command
program
  .command('agents')
  .description('Generate an AGENTS.md that teaches AI agents how to use Specifian')
  .option('--out <file>', 'Output file path', './AGENTS.md')
  .action(async (opts: { out: string }) => {
    const outPath = path.resolve(opts.out);
    try {
      await fs.promises.writeFile(outPath, generateAgentsDoc(), 'utf-8');
      console.log(`✅ Generated: ${outPath}`);
      console.log(
        'This file is static — agents discover categories at runtime via MCP, ' +
          'so you need not regenerate it when adding categories.',
      );
    } catch (err) {
      console.error(
        'Failed to generate AGENTS.md:',
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
  });

program.parse(process.argv);
