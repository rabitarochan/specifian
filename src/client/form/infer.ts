/**
 * infer.ts — infers a JSON Schema subset from front-matter data
 *
 * Pure functions that run in the browser. No side effects, no exceptions thrown.
 */

import type { JsonSchema } from './schemaTypes';

/**
 * Infers a JsonSchema from a single value.
 * - string   → { type: 'string' }
 * - number   → Number.isInteger → { type: 'integer' } else { type: 'number' }
 * - boolean  → { type: 'boolean' }
 * - array    → { type: 'array', items: <inferred> }
 *               empty array → items: { type: 'string' }
 *               all elements are objects → merge keys from all elements to build items
 *               otherwise → infer from the first element
 * - plain object → { type: 'object', properties: { ... } } (recursive)
 * - null / undefined / other → { type: 'string' }
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

    // If every element is a plain object (not null, not array), merge all keys
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

    // Otherwise: infer from the first element
    return { type: 'array', items: inferValue(value[0]) };
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    // Plain object
    return inferObject(value as Record<string, unknown>);
  }

  // Other (function, symbol, bigint, etc.)
  return { type: 'string' };
}

/** Creates { type: 'object', properties: {...} } from a Record<string, unknown>. */
function inferObject(data: Record<string, unknown>): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const [key, val] of Object.entries(data)) {
    properties[key] = inferValue(val);
  }
  return { type: 'object', properties };
}

/**
 * Infers a JSON Schema from the complete front-matter data.
 * Always returns { type: 'object', properties: {...} }.
 * Never throws.
 */
export function inferSchema(data: Record<string, unknown>): JsonSchema {
  return inferObject(data);
}
