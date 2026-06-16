/**
 * Schema-driven recursive form renderer.
 *
 * <SchemaForm schema value onChange /> — value is front-matter data
 * (Record<string, unknown>). All changes produce a new object tree (immutable).
 *
 * Rendering rules:
 *   string                → text input (select if enum)
 *   number / integer      → number input
 *   boolean               → checkbox
 *   object                → nested fieldset (recursive)
 *   array<all-scalar obj>  → editable table (ObjectArrayTable)
 *   array<nested obj>      → list of fieldsets (add/delete/reorder)
 *   array<scalar>          → list of input rows (add/delete)
 *   unknown                → read-only JSON fallback (value preserved)
 *
 * Optional fields with no value render empty controls and don't add a key until typed.
 * Clearing a scalar removes the key (false is retained for boolean).
 * Keys not in schema.properties are rendered at the bottom as "Extra fields" via
 * inferSchema so they survive round-trips.
 */
import type { JsonSchema } from './schemaTypes';
import { primaryType } from './schemaTypes';
import { inferSchema } from './infer';
import { ScalarControl } from './ScalarControl';
import { ObjectArrayTable } from './ObjectArrayTable';
import {
  asArray,
  asRecord,
  defaultValueFor,
  extraKeys,
  fieldLabel,
  isAllScalarObject,
  isRequired,
  isScalarType,
  itemsSchema,
  omitKey,
  setKey,
} from './formUtils';

interface SchemaFormProps {
  schema: JsonSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/** Top-level: expand as an object */
export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  return (
    <div className="sb-schema-form">
      <ObjectFields schema={schema} value={value} onChange={onChange} />
    </div>
  );
}

/** Render each property of an object + any extra keys not in the schema */
function ObjectFields({
  schema,
  value,
  onChange,
}: {
  schema: JsonSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const props = schema.properties ?? {};
  const propKeys = Object.keys(props);
  const outsideKeys = extraKeys(value, schema);

  const setField = (key: string, next: unknown): void => {
    onChange(
      next === undefined ? omitKey(value, key) : setKey(value, key, next),
    );
  };

  // Inferred schema for extra keys only (no description etc.)
  const extraData: Record<string, unknown> = {};
  for (const k of outsideKeys) extraData[k] = value[k];
  const extraSchema = outsideKeys.length > 0 ? inferSchema(extraData) : null;

  return (
    <>
      {propKeys.map((key) => (
        <Field
          key={key}
          fieldKey={key}
          schema={props[key]}
          required={isRequired(schema, key)}
          value={value[key]}
          onChange={(next) => setField(key, next)}
        />
      ))}

      {extraSchema && (
        <div className="sb-schema-extra">
          <div className="sb-schema-extra__divider">Extra fields</div>
          {outsideKeys.map((key) => (
            <Field
              key={key}
              fieldKey={key}
              schema={extraSchema.properties?.[key] ?? {}}
              required={false}
              value={value[key]}
              onChange={(next) => setField(key, next)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** Render a single field (label + type-appropriate control) */
function Field({
  fieldKey,
  schema,
  required,
  value,
  onChange,
}: {
  fieldKey: string;
  schema: JsonSchema;
  required: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const t = primaryType(schema);
  const label = fieldLabel(schema, fieldKey);

  // object → nested fieldset
  if (t === 'object') {
    return (
      <fieldset className="sb-fieldset">
        <legend className="sb-fieldset__legend">
          {label}
          {required && <RequiredStar />}
        </legend>
        {schema.description && (
          <p className="sb-field__hint">{schema.description}</p>
        )}
        <ObjectFields
          schema={schema}
          value={asRecord(value)}
          onChange={(next) => onChange(next)}
        />
      </fieldset>
    );
  }

  // array
  if (t === 'array') {
    const items = itemsSchema(schema);
    const itemType = primaryType(items);

    // array of all-scalar object → table
    if (isAllScalarObject(items)) {
      return (
        <div className="sb-field">
          <FieldLabel label={label} required={required} />
          {schema.description && (
            <p className="sb-field__hint">{schema.description}</p>
          )}
          <ObjectArrayTable
            schema={schema}
            rows={asArray(value)}
            onChange={(next) => onChange(next)}
          />
        </div>
      );
    }

    // array of scalar → list of input rows
    if (isScalarType(itemType)) {
      return (
        <div className="sb-field">
          <FieldLabel label={label} required={required} />
          {schema.description && (
            <p className="sb-field__hint">{schema.description}</p>
          )}
          <ScalarArray
            items={items}
            values={asArray(value)}
            onChange={(next) => onChange(next)}
          />
        </div>
      );
    }

    // array of nested object (or unknown) → list of fieldsets
    return (
      <div className="sb-field">
        <FieldLabel label={label} required={required} />
        {schema.description && (
          <p className="sb-field__hint">{schema.description}</p>
        )}
        <ObjectArrayList
          items={items}
          values={asArray(value)}
          onChange={(next) => onChange(next)}
        />
      </div>
    );
  }

  // scalar (string/number/integer/boolean, including enum)
  if (isScalarType(t)) {
    if (t === 'boolean') {
      return (
        <div className="sb-field sb-field--inline">
          <label className="sb-checkbox-label">
            <ScalarControl
              schema={schema}
              value={value}
              allowEmpty={!required}
              onChange={onChange}
              ariaLabel={label}
            />
            <span className="sb-field__label">
              {label}
              {required && <RequiredStar />}
            </span>
          </label>
          {schema.description && (
            <p className="sb-field__hint">{schema.description}</p>
          )}
        </div>
      );
    }
    return (
      <div className="sb-field">
        <FieldLabel label={label} required={required} />
        <ScalarControl
          schema={schema}
          value={value}
          allowEmpty={!required}
          onChange={onChange}
          ariaLabel={label}
        />
        {schema.description && (
          <p className="sb-field__hint">{schema.description}</p>
        )}
      </div>
    );
  }

  // Unknown/unsupported → read-only JSON fallback (value preserved)
  return (
    <div className="sb-field">
      <FieldLabel label={label} required={required} />
      <pre className="sb-json-fallback" aria-label={`${label} (read-only)`}>
        {safeStringify(value)}
      </pre>
      <p className="sb-field__hint">
        This type cannot be edited in the form. Use the Text tab to edit it.
      </p>
    </div>
  );
}

/** List of input rows for an array of scalars */
function ScalarArray({
  items,
  values,
  onChange,
}: {
  items: JsonSchema;
  values: unknown[];
  onChange: (next: unknown[]) => void;
}) {
  const updateAt = (index: number, next: unknown): void => {
    const out = values.slice();
    // Keep the array element even when cleared (retain empty string / undefined)
    out[index] = next;
    onChange(out);
  };
  const removeAt = (index: number): void => {
    const out = values.slice();
    out.splice(index, 1);
    onChange(out);
  };
  const add = (): void => {
    const def = defaultValueFor(items);
    onChange([...values, def === undefined ? '' : def]);
  };

  return (
    <div className="sb-scalar-array">
      {values.map((v, i) => (
        <div className="sb-scalar-array__row" key={i}>
          <ScalarControl
            schema={items}
            value={v}
            allowEmpty
            onChange={(next) => updateAt(i, next)}
            ariaLabel={`Item ${i + 1}`}
          />
          <button
            type="button"
            className="sb-row-btn sb-row-btn--danger"
            aria-label="Delete"
            onClick={() => removeAt(i)}
          >
            Delete
          </button>
        </div>
      ))}
      <button type="button" className="sb-link-btn" onClick={add}>
        + Add
      </button>
    </div>
  );
}

/** List of fieldsets for an array of (nested) objects */
function ObjectArrayList({
  items,
  values,
  onChange,
}: {
  items: JsonSchema;
  values: unknown[];
  onChange: (next: unknown[]) => void;
}) {
  const updateAt = (index: number, next: Record<string, unknown>): void => {
    const out = values.slice();
    out[index] = next;
    onChange(out);
  };
  const removeAt = (index: number): void => {
    const out = values.slice();
    out.splice(index, 1);
    onChange(out);
  };
  const move = (index: number, dir: -1 | 1): void => {
    const target = index + dir;
    if (target < 0 || target >= values.length) return;
    const out = values.slice();
    const [moved] = out.splice(index, 1);
    out.splice(target, 0, moved);
    onChange(out);
  };
  const add = (): void => {
    const def = defaultValueFor(items);
    onChange([...values, def ?? {}]);
  };

  return (
    <div className="sb-object-list">
      {values.map((v, i) => (
        <fieldset className="sb-fieldset sb-fieldset--item" key={i}>
          <legend className="sb-fieldset__legend">
            #{i + 1}
            <span className="sb-fieldset__actions">
              <button
                type="button"
                className="sb-row-btn"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="sb-row-btn"
                aria-label="Move down"
                disabled={i === values.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="sb-row-btn sb-row-btn--danger"
                aria-label="Delete"
                onClick={() => removeAt(i)}
              >
                Delete
              </button>
            </span>
          </legend>
          <ObjectFields
            schema={items}
            value={asRecord(v)}
            onChange={(next) => updateAt(i, next)}
          />
        </fieldset>
      ))}
      <button type="button" className="sb-link-btn" onClick={add}>
        + Add
      </button>
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <span className="sb-field__label">
      {label}
      {required && <RequiredStar />}
    </span>
  );
}

function RequiredStar() {
  return (
    <span className="sb-required" aria-label="Required">
      {' '}
      *
    </span>
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
