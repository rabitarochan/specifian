/**
 * Input control for scalar values (string/number/integer/boolean, including enum).
 * Used for both form fields and table cells.
 *
 * value === undefined means the key is unset. Clearing the input calls onChange(undefined),
 * and the caller removes the key. boolean false is kept as an explicit value.
 */
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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

/**
 * Tailwind class for compact cell inputs (borderless until focused).
 * Reproduces sb-cell-input: transparent border/bg at rest, hover shows bg-muted,
 * focus shows white bg + indigo border + ring.
 */
const cellInputClass =
  'font-[inherit] text-[13px] w-full min-w-[90px] px-[7px] py-[5px] ' +
  'border border-transparent bg-transparent rounded text-foreground ' +
  'hover:bg-muted ' +
  'focus:outline-none focus:bg-background focus:border-ring focus:ring-2 focus:ring-[#eef2ff] ' +
  'cursor-default';

export function ScalarControl({
  schema,
  value,
  onChange,
  allowEmpty,
  compact,
  ariaLabel,
}: Props) {
  const t = primaryType(schema);

  // enum → select
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const current = value === undefined || value === null ? '' : String(value);
    return (
      <select
        className={
          compact
            ? cn(cellInputClass, 'cursor-pointer')
            : cn(
                'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors',
                'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )
        }
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
        className="size-[15px] accent-[#4f46e5] cursor-pointer"
        aria-label={ariaLabel}
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (t === 'number' || t === 'integer') {
    const current =
      value === undefined || value === null ? '' : String(value);
    if (compact) {
      return (
        <input
          type="number"
          className={cellInputClass}
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
    return (
      <Input
        type="number"
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
  if (compact) {
    return (
      <input
        type="text"
        className={cellInputClass}
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
  return (
    <Input
      type="text"
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
