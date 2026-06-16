/**
 * Input control for scalar values (string/number/integer/boolean, including enum).
 * Used for both form fields and table cells.
 *
 * value === undefined means the key is unset. Clearing the input calls onChange(undefined),
 * and the caller removes the key. boolean false is kept as an explicit value.
 */
import type { JsonSchema } from './schemaTypes';
import { primaryType } from './schemaTypes';

interface Props {
  schema: JsonSchema;
  value: unknown;
  /** undefined means delete the key */
  onChange: (next: unknown) => void;
  /** Whether to show an empty option for non-required enum / select */
  allowEmpty: boolean;
  /** Compact display for table cells */
  compact?: boolean;
  ariaLabel?: string;
}

export function ScalarControl({
  schema,
  value,
  onChange,
  allowEmpty,
  compact,
  ariaLabel,
}: Props) {
  const t = primaryType(schema);
  const inputClass = compact ? 'sb-cell-input' : 'sb-input';

  // enum → select
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const current = value === undefined || value === null ? '' : String(value);
    return (
      <select
        className={inputClass}
        value={current}
        aria-label={ariaLabel}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          // Restore the original value (with its original type) from the enum
          const match = schema.enum?.find((opt) => String(opt) === raw);
          onChange(match ?? raw);
        }}
      >
        {(allowEmpty || current === '') && <option value="">—</option>}
        {schema.enum.map((opt, i) => (
          <option key={i} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    );
  }

  if (t === 'boolean') {
    return (
      <input
        type="checkbox"
        className="sb-checkbox"
        aria-label={ariaLabel}
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (t === 'number' || t === 'integer') {
    const current =
      value === undefined || value === null ? '' : String(value);
    return (
      <input
        type="number"
        className={inputClass}
        value={current}
        aria-label={ariaLabel}
        step={t === 'integer' ? 1 : 'any'}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const num = t === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
          if (Number.isNaN(num)) {
            onChange(undefined);
            return;
          }
          onChange(num);
        }}
      />
    );
  }

  // string (and unknown scalar fallback)
  const current = value === undefined || value === null ? '' : String(value);
  return (
    <input
      type="text"
      className={inputClass}
      value={current}
      aria-label={ariaLabel}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(undefined);
          return;
        }
        onChange(raw);
      }}
    />
  );
}
