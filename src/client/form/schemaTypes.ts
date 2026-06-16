/**
 * JSON Schema subset used for form generation (fixed contract).
 * Shared by yamlSync.ts / infer.ts / SchemaForm.tsx.
 * Unsupported keywords are silently ignored during rendering.
 */

export type JsonSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

export interface JsonSchema {
  type?: JsonSchemaType | JsonSchemaType[];
  /** Displayed as the field label */
  title?: string;
  /** Displayed as help text */
  description?: string;
  /** string: renders as a select */
  enum?: unknown[];
  default?: unknown;
  /** object */
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  /** array */
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  /** number */
  minimum?: number;
  maximum?: number;
}

/** Returns the primary type regardless of whether type is a single value, array, or absent (unknown → null). */
export function primaryType(schema: JsonSchema): JsonSchemaType | null {
  const t = schema.type;
  if (!t) {
    // Even without type, infer from properties / items
    if (schema.properties) return 'object';
    if (schema.items) return 'array';
    if (schema.enum) return 'string';
    return null;
  }
  if (Array.isArray(t)) {
    return t.find((x) => x !== 'null') ?? t[0] ?? null;
  }
  return t;
}
