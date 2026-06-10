import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import { loadSpecs } from './store.js';
import type { ValidationIssue, ValidationReport } from '../shared/types.js';

/** loadCategorySchema の戻り値 */
export interface CategorySchemaResult {
  /** パースに成功したスキーマオブジェクト。_schema.json が存在しない場合は null */
  schema: Record<string, unknown> | null;
  /**
   * ファイルの読み込みまたは JSON パースに失敗した場合のエラーメッセージ。
   * schema が null かつ error が undefined の場合は ENOENT (ファイルなし) を意味する。
   */
  error?: string;
}

/**
 * specsDir/<category>/_schema.json を読み込んで返す共有ヘルパー。
 * - category が '' のときは specsDir 直下の _schema.json を参照する。
 * - ファイルが存在しない (ENOENT) → { schema: null }
 * - 読み込み失敗または JSON パース失敗 → { schema: null, error: <メッセージ> }
 */
export async function loadCategorySchema(
  specsDir: string,
  category: string,
): Promise<CategorySchemaResult> {
  const segments = category === '' ? [] : category.split('/');
  const schemaPath = path.join(specsDir, ...segments, '_schema.json');

  let schemaText: string;
  try {
    schemaText = await fs.readFile(schemaPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { schema: null };
    }
    return {
      schema: null,
      error: `_schema.json を読み込めませんでした: ${String(err)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaText);
  } catch (err) {
    return {
      schema: null,
      error: `_schema.json の JSON パースに失敗しました: ${String(err)}`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      schema: null,
      error: '_schema.json はオブジェクトである必要があります',
    };
  }

  return { schema: parsed as Record<string, unknown> };
}

/**
 * Validate front-matter data of all normal specs (excluding _ and _template)
 * against _schema.json files found in each category directory.
 * Schemas only apply to specs in the exact matching category (no subcategory inheritance).
 */
export async function validateSpecs(specsDir: string): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];

  // Load all specs
  const allSpecs = await loadSpecs(specsDir);

  // Find all unique categories that have a _schema.json
  const categoriesWithSchema = new Set<string>();
  for (const spec of allSpecs) {
    if (spec.category !== '') {
      const schemaPath = path.join(specsDir, ...spec.category.split('/'), '_schema.json');
      try {
        await fs.access(schemaPath);
        categoriesWithSchema.add(spec.category);
      } catch {
        // No schema for this category
      }
    }
  }

  // Also scan directories directly to find _schema.json files not covered by existing specs
  // (edge case: a category with a schema but no specs — nothing to validate, skip)

  // Compile schemas and validate
  const ajv = new Ajv({ allErrors: true, strict: false });
  const compiledSchemas = new Map<string, ReturnType<Ajv['compile']> | null>();

  for (const category of categoriesWithSchema) {
    const schemaSpecId = `${category}:_schema`;

    const result = await loadCategorySchema(specsDir, category);

    if (result.error !== undefined) {
      issues.push({
        specId: schemaSpecId,
        path: '/',
        message: result.error,
      });
      compiledSchemas.set(category, null);
      continue;
    }

    if (result.schema === null) {
      // ENOENT — should not normally happen since we checked access above, skip silently
      compiledSchemas.set(category, null);
      continue;
    }

    try {
      const validate = ajv.compile(result.schema);
      compiledSchemas.set(category, validate);
    } catch (err) {
      issues.push({
        specId: schemaSpecId,
        path: '/',
        message: `_schema.json のスキーマコンパイルに失敗しました: ${String(err)}`,
      });
      compiledSchemas.set(category, null);
    }
  }

  // Validate each normal spec (exclude _ index and _template) in categories with a schema
  for (const spec of allSpecs) {
    // Only process exact category match (no subcategory inheritance)
    if (!categoriesWithSchema.has(spec.category)) continue;
    // Exclude _ (index) and _template
    if (spec.slug === '_' || spec.slug === '_template') continue;

    const validate = compiledSchemas.get(spec.category);
    if (!validate) continue; // Schema had an error, already reported

    const valid = validate(spec.data);
    if (!valid && validate.errors) {
      for (const err of validate.errors) {
        const instancePath = err.instancePath || '/';

        // Build a helpful message
        let message = err.message ?? 'バリデーションエラー';

        // Enhance with params context for common keywords
        if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
          message = `必須プロパティがありません: '${String(err.params['missingProperty'])}'`;
        } else if (err.keyword === 'additionalProperties' && err.params && 'additionalProperty' in err.params) {
          message = `許可されていないプロパティ: '${String(err.params['additionalProperty'])}'`;
        } else if (err.keyword === 'enum' && err.params && 'allowedValues' in err.params) {
          const allowed = (err.params['allowedValues'] as unknown[]).join(', ');
          message = `${err.message ?? 'enum エラー'} (許可値: ${allowed})`;
        } else if (err.keyword === 'type' && err.params && 'type' in err.params) {
          message = `型が正しくありません: ${String(err.params['type'])} が必要です`;
        }

        issues.push({
          specId: spec.id,
          path: instancePath,
          message,
        });
      }
    }
  }

  return { issues };
}
