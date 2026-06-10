import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import { loadSpecs } from './store.js';
import type { ValidationIssue, ValidationReport } from '../shared/types.js';

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
    const schemaPath = path.join(specsDir, ...category.split('/'), '_schema.json');
    const schemaSpecId = `${category}:_schema`;

    let schemaText: string;
    try {
      schemaText = await fs.readFile(schemaPath, 'utf-8');
    } catch (err) {
      issues.push({
        specId: schemaSpecId,
        path: '/',
        message: `_schema.json を読み込めませんでした: ${String(err)}`,
      });
      compiledSchemas.set(category, null);
      continue;
    }

    let schemaJson: unknown;
    try {
      schemaJson = JSON.parse(schemaText);
    } catch (err) {
      issues.push({
        specId: schemaSpecId,
        path: '/',
        message: `_schema.json の JSON パースに失敗しました: ${String(err)}`,
      });
      compiledSchemas.set(category, null);
      continue;
    }

    try {
      const validate = ajv.compile(schemaJson as object);
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
