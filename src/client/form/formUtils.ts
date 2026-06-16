/**
 * Pure helpers shared within SchemaForm.
 * All are non-mutating (they return new objects/arrays).
 */
import type { JsonSchema, JsonSchemaType } from './schemaTypes';
import { primaryType } from './schemaTypes';

/** Field label: schema.title ?? key */
export function fieldLabel(schema: JsonSchema, key: string): string {
  return schema.title ?? key;
}

/** Whether the key is required */
export function isRequired(parent: JsonSchema | undefined, key: string): boolean {
  return parent?.required?.includes(key) ?? false;
}

/** Extracts the items schema from an array schema (returns {} if absent). */
export function itemsSchema(schema: JsonSchema): JsonSchema {
  return schema.items ?? {};
}

/** Whether the type is a scalar (string/number/integer/boolean). */
export function isScalarType(t: JsonSchemaType | null): boolean {
  return t === 'string' || t === 'number' || t === 'integer' || t === 'boolean';
}

/**
 * Determines whether items is "an object where all properties are scalars".
 * This is the condition for using the table widget: properties must exist,
 * be non-empty, and every property's primaryType must be a scalar.
 */
export function isAllScalarObject(schema: JsonSchema): boolean {
  if (primaryType(schema) !== 'object') return false;
  const props = schema.properties;
  if (!props) return false;
  const keys = Object.keys(props);
  if (keys.length === 0) return false;
  return keys.every((k) => isScalarType(primaryType(props[k])));
}

/** Whether the schema is an object schema (has properties, or type=object). */
export function isObjectSchema(schema: JsonSchema): boolean {
  return primaryType(schema) === 'object';
}

/**
 * Generates a new value based on the schema's default.
 * Returns a deep copy of the default if one exists.
 * Otherwise: empty object for object, empty array for array, type-appropriate empty value for scalars.
 */
export function defaultValueFor(schema: JsonSchema): unknown {
  if (schema.default !== undefined) {
    return cloneValue(schema.default);
  }
  const t = primaryType(schema);
  switch (t) {
    case 'object':
      return {};
    case 'array':
      return [];
    case 'boolean':
      return false;
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return undefined; // empty number = key not set
    default:
      return undefined;
  }
}

/** Deep-copies a JSON-compatible value. */
export function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => cloneValue(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = cloneValue(v);
  }
  return out as T;
}

/** Extracts an object value (arrays, null, and non-objects are treated as {}). */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Extracts an array value (non-arrays are treated as []). */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Returns a new record with the specified key omitted (non-mutating).
 */
export function omitKey(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k !== key) next[k] = v;
  }
  return next;
}

/**
 * Returns a new record with the key set (non-mutating, preserving insertion order).
 * Existing keys keep their position with the value replaced; new keys are appended.
 */
export function setKey(
  record: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...record };
  next[key] = value;
  return next;
}

/** Returns keys of value that are not present in schema.properties. */
export function extraKeys(
  value: Record<string, unknown>,
  schema: JsonSchema,
): string[] {
  const props = schema.properties ?? {};
  return Object.keys(value).filter((k) => !(k in props));
}
