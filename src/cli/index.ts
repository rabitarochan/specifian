import fs from 'node:fs';
import path from 'node:path';
import { program } from 'commander';
import { startServer } from '../server/app.js';
import { initSpecs } from '../server/init.js';
import { loadSpecs } from '../server/store.js';
import { runGenerator } from '../server/generate.js';
import { validateSpecs } from '../server/validate.js';
import { startMcpServer } from '../server/mcp.js';

const VERSION = '0.1.0';

program
  .name('specbook')
  .version(VERSION)
  .description('Storybook ライクな MDX スペック管理ツール');

// serve command (default)
program
  .command('serve', { isDefault: true })
  .description('スペックサーバーを起動します')
  .option('--dir <specsDir>', 'スペックディレクトリー', './specs')
  .option('--port <port>', 'ポート番号', '4400')
  .option('--open', 'ブラウザーを自動的に開く', false)
  .action(async (opts: { dir: string; port: string; open: boolean }) => {
    const specsDir = path.resolve(opts.dir);
    const port = parseInt(opts.port, 10);

    if (!fs.existsSync(specsDir)) {
      console.error(
        `エラー: スペックディレクトリーが見つかりません: ${specsDir}`,
      );
      console.error('ヒント: specbook init --dir <ディレクトリー> で初期化できます。');
      process.exit(1);
    }

    console.log(`\n🗒  specbook v${VERSION}`);
    console.log(`📂 スペックディレクトリー: ${specsDir}`);
    console.log(`🚀 サーバーを起動しています... http://localhost:${port}\n`);

    try {
      await startServer({ specsDir, port });
      console.log(`✅ サーバー起動完了: http://localhost:${port}`);

      if (opts.open) {
        const { default: open } = await import('open');
        await open(`http://localhost:${port}`);
      }
    } catch (err) {
      console.error('サーバーの起動に失敗しました:', err);
      process.exit(1);
    }
  });

// init command
program
  .command('init')
  .description('サンプルスペックを使って初期化します')
  .option('--dir <specsDir>', '初期化先ディレクトリー', './specs')
  .action(async (opts: { dir: string }) => {
    const targetDir = path.resolve(opts.dir);
    console.log(`📂 初期化先: ${targetDir}`);
    try {
      await initSpecs(targetDir);
      console.log(`✅ 初期化完了: ${targetDir}`);
      console.log('次のコマンドでサーバーを起動できます:');
      console.log(`  specbook serve --dir ${opts.dir}`);
    } catch (err) {
      console.error('初期化に失敗しました:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// generate command
program
  .command('generate <generator>')
  .description('コード生成テンプレートを実行します')
  .option('--dir <specsDir>', 'スペックディレクトリー', './specs')
  .option('--spec <specId>', '対象スペック ID (省略時は全スペック)')
  .option('--out <outDir>', '出力先ディレクトリー', '.')
  .action(
    async (
      generator: string,
      opts: { dir: string; spec?: string; out: string },
    ) => {
      const specsDir = path.resolve(opts.dir);

      if (!fs.existsSync(specsDir)) {
        console.error(
          `エラー: スペックディレクトリーが見つかりません: ${specsDir}`,
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
          console.log('生成されたファイルはありません。');
        } else {
          console.log(`✅ ${files.length} 件のファイルを生成しました:`);
          for (const f of files) {
            console.log(`  ${f.path}`);
          }
        }
      } catch (err) {
        console.error(
          'コード生成に失敗しました:',
          err instanceof Error ? err.message : err,
        );
        process.exit(1);
      }
    },
  );

// validate command
program
  .command('validate')
  .description('front-matter をスキーマに対してバリデーションします')
  .option('--dir <specsDir>', 'スペックディレクトリー', './specs')
  .action(async (opts: { dir: string }) => {
    const specsDir = path.resolve(opts.dir);

    if (!fs.existsSync(specsDir)) {
      console.error(
        `エラー: スペックディレクトリーが見つかりません: ${specsDir}`,
      );
      process.exit(1);
    }

    try {
      const report = await validateSpecs(specsDir);

      if (report.issues.length === 0) {
        console.log('✅ front-matter はすべてのスキーマに適合しています');
        process.exit(0);
      } else {
        console.error(`❌ スキーマ違反が ${report.issues.length} 件見つかりました:`);
        for (const issue of report.issues) {
          console.error(`  ${issue.specId} ${issue.path}: ${issue.message}`);
        }
        process.exit(1);
      }
    } catch (err) {
      console.error(
        'バリデーションに失敗しました:',
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
  });

// mcp command
program
  .command('mcp')
  .description('MCP サーバー (stdio) を起動します。AI エージェントがスペックを読み書きできます')
  .option('--dir <specsDir>', 'スペックディレクトリー', './specs')
  .action(async (opts: { dir: string }) => {
    const specsDir = path.resolve(opts.dir);

    if (!fs.existsSync(specsDir)) {
      console.error(
        `エラー: スペックディレクトリーが見つかりません: ${specsDir}`,
      );
      console.error('ヒント: specbook init --dir <ディレクトリー> で初期化できます。');
      process.exit(1);
    }

    // 注意: stdout は MCP プロトコルが占有するため、起動通知は必ず stderr へ。
    console.error(`specbook MCP server (stdio) — specs: ${specsDir}`);

    try {
      await startMcpServer(specsDir);
    } catch (err) {
      console.error(
        'MCP サーバーの起動に失敗しました:',
        err instanceof Error ? err.message : err,
      );
      process.exit(1);
    }
  });

program.parse(process.argv);
