import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import { loadSpecs } from './store.js';
import type { ValidationIssue, ValidationReport } from '../shared/types.js';

/** Return value of loadCategorySchema. */
export interface CategorySchemaResult {
  /** Parsed schema object on success; null when _schema.json does not exist. */
  schema: Record<string, unknown> | null;
  /**
   * Error message when the file cannot be read or JSON parsing fails.
   * When schema is null and error is undefined it means ENOENT (file absent).
   */
  error?: string;
}

/**
 * Shared helper that reads specsDir/<category>/_schema.json.
 * - When category is '' it reads _schema.json directly under specsDir.
 * - File absent (ENOENT) → { schema: null }
 * - Read or JSON parse failure → { schema: null, error: <message> }
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
      error: `Failed to read _schema.json: ${String(err)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaText);
  } catch (err) {
    return {
      schema: null,
      error: `Failed to parse _schema.json as JSON: ${String(err)}`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      schema: null,
      error: '_schema.json must be a JSON object',
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
        message: `Failed to compile _schema.json as a schema: ${String(err)}`,
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
        let message = err.message ?? 'Validation error';

        // Enhance with params context for common keywords
        if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
          message = `Missing required property: '${String(err.params['missingProperty'])}'`;
        } else if (err.keyword === 'additionalProperties' && err.params && 'additionalProperty' in err.params) {
          message = `Additional property not allowed: '${String(err.params['additionalProperty'])}'`;
        } else if (err.keyword === 'enum' && err.params && 'allowedValues' in err.params) {
          const allowed = (err.params['allowedValues'] as unknown[]).join(', ');
          message = `${err.message ?? 'Enum error'} (allowed values: ${allowed})`;
        } else if (err.keyword === 'type' && err.params && 'type' in err.params) {
          message = `Incorrect type: expected ${String(err.params['type'])}`;
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
