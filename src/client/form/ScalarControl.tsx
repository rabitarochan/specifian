/**
 * スカラー値 (string/number/integer/boolean、enum 含む) の入力コントロール。
 * フォームのフィールドとテーブルセルの両方から使う。
 *
 * value === undefined はキー未設定を表す。空入力に戻すと onChange(undefined) を呼び、
 * 呼び出し側がキーを削除する。boolean の false は明示値として保持する。
 */
import type { JsonSchema } from './schemaTypes';
import { primaryType } from './schemaTypes';

interface Props {
  schema: JsonSchema;
  value: unknown;
  /** undefined はキー削除を意味する */
  onChange: (next: unknown) => void;
  /** 必須でない enum / select に空選択肢を出すか */
  allowEmpty: boolean;
  /** テーブルセル用のコンパクト表示 */
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
          // enum の元の値 (型) を復元する
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

  // string (および未知のスカラー扱い)
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
