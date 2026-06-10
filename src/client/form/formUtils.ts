/**
 * SchemaForm 内で共有する純粋ヘルパー群。
 * すべて非破壊 (新しいオブジェクト/配列を返す)。
 */
import type { JsonSchema, JsonSchemaType } from './schemaTypes';
import { primaryType } from './schemaTypes';

/** フィールドのラベル: schema.title ?? key */
export function fieldLabel(schema: JsonSchema, key: string): string {
  return schema.title ?? key;
}

/** key が required か */
export function isRequired(parent: JsonSchema | undefined, key: string): boolean {
  return parent?.required?.includes(key) ?? false;
}

/** array の items スキーマを取り出す (無ければ空オブジェクト) */
export function itemsSchema(schema: JsonSchema): JsonSchema {
  return schema.items ?? {};
}

/** スカラー型か (string/number/integer/boolean) */
export function isScalarType(t: JsonSchemaType | null): boolean {
  return t === 'string' || t === 'number' || t === 'integer' || t === 'boolean';
}

/**
 * items が「全プロパティがスカラーのオブジェクト」か判定。
 * テーブルウィジェット採用の条件。properties が存在し、空でなく、
 * すべての値の primaryType がスカラーであること。
 */
export function isAllScalarObject(schema: JsonSchema): boolean {
  if (primaryType(schema) !== 'object') return false;
  const props = schema.properties;
  if (!props) return false;
  const keys = Object.keys(props);
  if (keys.length === 0) return false;
  return keys.every((k) => isScalarType(primaryType(props[k])));
}

/** object スキーマか (properties を持つ、または type=object) */
export function isObjectSchema(schema: JsonSchema): boolean {
  return primaryType(schema) === 'object';
}

/**
 * スキーマの default に基づく新規値を生成する。
 * default があればそれを (ディープコピーして) 返す。
 * object なら required から最小の {} を作るのではなく空オブジェクト、
 * array なら空配列、scalar なら型に応じた空値。
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
      return undefined; // 数値は空 = キー未設定
    default:
      return undefined;
  }
}

/** JSON 互換値のディープコピー */
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

/** object 値を取り出す (配列・null・非オブジェクトは {} 扱い) */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** array 値を取り出す (非配列は [] 扱い) */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * record から指定キーを除いた新しい record を返す (非破壊)。
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
 * record にキーを設定した新しい record を返す (非破壊、挿入順を維持)。
 * 既存キーは位置を保ったまま値を差し替え、新規キーは末尾に追加する。
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

/** value のキーのうち schema.properties に存在しないものを返す */
export function extraKeys(
  value: Record<string, unknown>,
  schema: JsonSchema,
): string[] {
  const props = schema.properties ?? {};
  return Object.keys(value).filter((k) => !(k in props));
}
