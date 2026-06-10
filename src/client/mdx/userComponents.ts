/**
 * ユーザー定義コンポーネント (specs/_components/*.tsx|jsx) のランタイムコンパイラー。
 *
 * - GET /api/components で UserComponentFile[] を取得
 * - 各ファイルを sucrase (dynamic import でメインバンドルから分離) で
 *   TSX/JSX → CJS に変換 (classic runtime, React.createElement)
 * - new Function('require','module','exports', code) で実行
 * - require シムは 'react' のみ解決し、それ以外の import は明確なエラーを投げる
 * - export を収集: 名前付き export のうち関数かつ先頭大文字のもの + default export (ファイル名の PascalCase)
 * - 1 ファイルの失敗は他に波及させない (errors にまとめる)
 * - 結果はキャッシュし、invalidate() で破棄できる
 */
import * as React from 'react';
import type { ComponentType } from 'react';
import type { UserComponentFile } from '@shared/types';

export interface UserComponentsResult {
  components: Record<string, ComponentType<unknown>>;
  errors: { path: string; message: string }[];
}

/**
 * require シム用の React 値。
 * `import * as React from 'react'` も `import React from 'react'` も解決できるよう、
 * React 名前空間そのものに加えて `default` プロパティとして自身を持たせる。
 * sucrase の imports interop は `.default` / 名前付きプロパティの両方を参照しうる。
 */
const reactModule: Record<string, unknown> = { ...(React as object), default: React };

function requireShim(id: string): unknown {
  if (id === 'react') return reactModule;
  throw new Error(`_components では 'react' 以外の import は使えません: ${id}`);
}

/** "StatusBadge.tsx" -> "StatusBadge"。ハイフン/アンダースコア区切りも PascalCase 化する */
function pascalCaseFromFilename(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath;
  const name = base.replace(/\.(tsx|jsx)$/i, '');
  return name
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function isComponentValue(v: unknown): v is ComponentType<unknown> {
  return typeof v === 'function';
}

async function compileFile(
  file: UserComponentFile,
  transform: typeof import('sucrase').transform,
): Promise<{ components: Record<string, ComponentType<unknown>>; error?: string }> {
  try {
    const { code } = transform(file.source, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
      filePath: file.path,
    });

    const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
    const fn = new Function('require', 'module', 'exports', code);
    fn(requireShim, moduleObj, moduleObj.exports);

    const exports = moduleObj.exports;
    const collected: Record<string, ComponentType<unknown>> = {};

    // 名前付き export: 関数かつ先頭が大文字のもの (default は別扱い)
    for (const [name, value] of Object.entries(exports)) {
      if (name === 'default') continue;
      if (name === '__esModule') continue;
      if (!/^[A-Z]/.test(name)) continue;
      if (isComponentValue(value)) {
        collected[name] = value;
      }
    }

    // default export → ファイル名の PascalCase
    const def = exports['default'];
    if (isComponentValue(def)) {
      collected[pascalCaseFromFilename(file.path)] = def;
    }

    return { components: collected };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { components: {}, error: message };
  }
}

let cache: Promise<UserComponentsResult> | null = null;

async function fetchComponentFiles(): Promise<UserComponentFile[]> {
  const res = await fetch('/api/components');
  if (!res.ok) {
    throw new Error(`GET /api/components が失敗しました (${res.status})`);
  }
  return (await res.json()) as UserComponentFile[];
}

async function build(): Promise<UserComponentsResult> {
  const { transform } = await import('sucrase');
  const files = await fetchComponentFiles();

  const components: Record<string, ComponentType<unknown>> = {};
  const errors: { path: string; message: string }[] = [];

  for (const file of files) {
    const result = await compileFile(file, transform);
    if (result.error) {
      errors.push({ path: file.path, message: result.error });
      continue;
    }
    // 後勝ち (ファイル名順なので決定的)
    Object.assign(components, result.components);
  }

  return { components, errors };
}

/** ユーザー定義コンポーネントを取得・コンパイルする (キャッシュあり) */
export function loadUserComponents(): Promise<UserComponentsResult> {
  if (!cache) cache = build();
  return cache;
}

/** キャッシュを破棄する (ファイル変更時に呼び出して再コンパイルさせる) */
export function invalidateUserComponents(): void {
  cache = null;
}
