/**
 * infer.ts — front-matter データから JSON Schema サブセットを推論する
 *
 * ブラウザで動作する純粋関数。副作用なし、例外を投げない。
 */

import type { JsonSchema } from './schemaTypes';

/**
 * 単一の値から JsonSchema を推論する。
 * - string   → { type: 'string' }
 * - number   → Number.isInteger → { type: 'integer' } else { type: 'number' }
 * - boolean  → { type: 'boolean' }
 * - array    → { type: 'array', items: <推論> }
 *               空配列 → items: { type: 'string' }
 *               要素が全てオブジェクト → 全要素のキーをマージして items を作成
 *               その他 → 最初の要素から推論
 * - plain object → { type: 'object', properties: { ... } } (再帰)
 * - null / undefined / その他 → { type: 'string' }
 */
function inferValue(value: unknown): JsonSchema {
  if (value === null || value === undefined) {
    return { type: 'string' };
  }

  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }

  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }

  if (typeof value === 'string') {
    return { type: 'string' };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: 'array', items: { type: 'string' } };
    }

    // 全要素がプレーンオブジェクト (null でも配列でもない) なら全キーをマージ
    const allObjects = value.every(
      (el) => el !== null && typeof el === 'object' && !Array.isArray(el),
    );
    if (allObjects) {
      const mergedProperties: Record<string, JsonSchema> = {};
      for (const el of value as Record<string, unknown>[]) {
        for (const [k, v] of Object.entries(el)) {
          if (!(k in mergedProperties)) {
            mergedProperties[k] = inferValue(v);
          }
        }
      }
      return {
        type: 'array',
        items: { type: 'object', properties: mergedProperties },
      };
    }

    // それ以外: 最初の要素から推論
    return { type: 'array', items: inferValue(value[0]) };
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    // プレーンオブジェクト
    return inferObject(value as Record<string, unknown>);
  }

  // その他 (function, symbol, bigint など)
  return { type: 'string' };
}

/** Record<string, unknown> から { type: 'object', properties: {...} } を作成 */
function inferObject(data: Record<string, unknown>): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const [key, val] of Object.entries(data)) {
    properties[key] = inferValue(val);
  }
  return { type: 'object', properties };
}

/**
 * front-matter データ全体から JSON Schema を推論する。
 * 返り値は常に { type: 'object', properties: {...} }。
 * 決して例外を投げない。
 */
export function inferSchema(data: Record<string, unknown>): JsonSchema {
  return inferObject(data);
}
