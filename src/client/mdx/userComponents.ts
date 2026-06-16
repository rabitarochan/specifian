/**
 * Runtime compiler for user-defined components (specs/_components/*.tsx|jsx).
 *
 * - Fetches UserComponentFile[] from GET /api/components
 * - Transforms each file from TSX/JSX → CJS using sucrase
 *   (split from the main bundle via dynamic import; classic runtime, React.createElement)
 * - Executes via new Function('require','module','exports', code)
 * - require shim resolves 'react' only; any other import throws a clear error
 * - Collects exports: named exports that are functions starting with an uppercase letter,
 *   plus default export (keyed by the filename in PascalCase)
 * - Failure in one file does not affect others (errors are aggregated)
 * - Results are cached and can be cleared with invalidate()
 */
import * as React from 'react';
import type { ComponentType } from 'react';
import type { UserComponentFile } from '@shared/types';

export interface UserComponentsResult {
  components: Record<string, ComponentType<unknown>>;
  errors: { path: string; message: string }[];
}

/**
 * React value used by the require shim.
 * To support both `import * as React from 'react'` and `import React from 'react'`,
 * the React namespace itself is spread and a `default` property pointing to itself is added.
 * sucrase's imports interop may reference either `.default` or named properties.
 */
const reactModule: Record<string, unknown> = { ...(React as object), default: React };

function requireShim(id: string): unknown {
  if (id === 'react') return reactModule;
  throw new Error(`_components may only import 'react': ${id}`);
}

/** "StatusBadge.tsx" → "StatusBadge". Also PascalCases hyphen/underscore-delimited names. */
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

    // Named exports: functions whose name starts with an uppercase letter (default is handled separately)
    for (const [name, value] of Object.entries(exports)) {
      if (name === 'default') continue;
      if (name === '__esModule') continue;
      if (!/^[A-Z]/.test(name)) continue;
      if (isComponentValue(value)) {
        collected[name] = value;
      }
    }

    // default export → keyed by filename in PascalCase
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
    throw new Error(`GET /api/components failed (${res.status})`);
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
    // Last write wins (deterministic because files are in filename order)
    Object.assign(components, result.components);
  }

  return { components, errors };
}

/** Fetches and compiles user-defined components (with caching). */
export function loadUserComponents(): Promise<UserComponentsResult> {
  if (!cache) cache = build();
  return cache;
}

/** Clears the cache (call when a file changes to trigger recompilation). */
export function invalidateUserComponents(): void {
  cache = null;
}
