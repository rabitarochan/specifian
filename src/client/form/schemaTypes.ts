/**
 * フォーム生成で扱う JSON Schema のサブセット (固定契約)。
 * yamlSync.ts / infer.ts / SchemaForm.tsx が共有する。
 * 未対応キーワードは無視して描画する (落とさない)。
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
  /** ラベルとして表示 */
  title?: string;
  /** ヘルプ文として表示 */
  description?: string;
  /** string: select 化 */
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

/** type が単一/配列/未指定のどれでも、主たる型を返す (不明は null) */
export function primaryType(schema: JsonSchema): JsonSchemaType | null {
  const t = schema.type;
  if (!t) {
    // type 未指定でも properties / items から推測する
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
