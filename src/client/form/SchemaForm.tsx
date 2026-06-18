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
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
    <div className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-4 mt-1 pt-4 border-t border-dashed border-input">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Extra fields
          </div>
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
      <fieldset className="border border-border rounded-lg px-3.5 pt-0 pb-3.5 m-0 bg-muted flex flex-col gap-3.5">
        <legend className="text-[13px] font-bold text-foreground px-1.5 inline-flex items-center gap-2">
          {label}
          {required && <RequiredStar />}
        </legend>
        {schema.description && (
          <p className="text-[12px] text-muted-foreground m-0">{schema.description}</p>
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
        <div className="flex flex-col gap-[5px]">
          <FieldLabel label={label} required={required} />
          {schema.description && (
            <p className="text-[12px] text-muted-foreground m-0">{schema.description}</p>
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
        <div className="flex flex-col gap-[5px]">
          <FieldLabel label={label} required={required} />
          {schema.description && (
            <p className="text-[12px] text-muted-foreground m-0">{schema.description}</p>
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
      <div className="flex flex-col gap-[5px]">
        <FieldLabel label={label} required={required} />
        {schema.description && (
          <p className="text-[12px] text-muted-foreground m-0">{schema.description}</p>
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
        <div className="flex flex-col gap-[5px]">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <ScalarControl
              schema={schema}
              value={value}
              allowEmpty={!required}
              onChange={onChange}
              ariaLabel={label}
            />
            <span className="text-[13px] font-semibold text-foreground">
              {label}
              {required && <RequiredStar />}
            </span>
          </label>
          {schema.description && (
            <p className="text-[12px] text-muted-foreground m-0">{schema.description}</p>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-[5px]">
        <FieldLabel label={label} required={required} />
        <ScalarControl
          schema={schema}
          value={value}
          allowEmpty={!required}
          onChange={onChange}
          ariaLabel={label}
        />
        {schema.description && (
          <p className="text-[12px] text-muted-foreground m-0">{schema.description}</p>
        )}
      </div>
    );
  }

  // Unknown/unsupported → read-only JSON fallback (value preserved)
  return (
    <div className="flex flex-col gap-[5px]">
      <FieldLabel label={label} required={required} />
      <pre
        className="font-mono text-[12px] bg-muted border border-border rounded-md px-2.5 py-2 m-0 overflow-x-auto text-muted-foreground whitespace-pre-wrap"
        aria-label={`${label} (read-only)`}
      >
        {safeStringify(value)}
      </pre>
      <p className="text-[12px] text-muted-foreground m-0">
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
    <div className="flex flex-col gap-1.5">
      {values.map((v, i) => (
        <div className="flex items-center gap-1.5" key={i}>
          <ScalarControl
            schema={items}
            value={v}
            allowEmpty
            onChange={(next) => updateAt(i, next)}
            ariaLabel={`Item ${i + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Delete"
            className={cn(
              'shrink-0',
              'hover:bg-destructive/10 hover:text-destructive',
            )}
            onClick={() => removeAt(i)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <button
        type="button"
        className="font-[inherit] border-none bg-transparent text-primary cursor-pointer px-1 underline text-left w-fit"
        onClick={add}
      >
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
    <div className="flex flex-col gap-2.5">
      {values.map((v, i) => (
        <fieldset
          className="border border-border rounded-lg px-3.5 pt-0 pb-3.5 m-0 bg-background flex flex-col gap-3.5"
          key={i}
        >
          <legend className="text-[13px] font-bold text-foreground px-1.5 inline-flex items-center gap-2">
            #{i + 1}
            <span className="inline-flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move down"
                disabled={i === values.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete"
                className="hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeAt(i)}
              >
                <Trash2 />
              </Button>
            </span>
          </legend>
          <ObjectFields
            schema={items}
            value={asRecord(v)}
            onChange={(next) => updateAt(i, next)}
          />
        </fieldset>
      ))}
      <button
        type="button"
        className="font-[inherit] border-none bg-transparent text-primary cursor-pointer px-1 underline text-left w-fit"
        onClick={add}
      >
        + Add
      </button>
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <span className="text-[13px] font-semibold text-foreground">
      {label}
      {required && <RequiredStar />}
    </span>
  );
}

function RequiredStar() {
  return (
    <span className="text-destructive font-bold" aria-label="Required">
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
