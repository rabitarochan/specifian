/**
 * スキーマ駆動の再帰フォームレンダラー。
 *
 * <SchemaForm schema value onChange /> — value は front-matter データ
 * (Record<string, unknown>)。すべての変更は新しいオブジェクトツリーを生成する
 * (非破壊)。
 *
 * 描画ルール:
 *   string                → text input (enum なら select)
 *   number / integer      → number input
 *   boolean               → checkbox
 *   object                → ネスト fieldset (再帰)
 *   array<all-scalar obj>  → 編集テーブル (ObjectArrayTable)
 *   array<nested obj>      → fieldset のリスト (追加/削除/並べ替え)
 *   array<scalar>          → 入力行リスト (追加/削除)
 *   不明                   → 読み取り専用 JSON フォールバック (値は保持)
 *
 * 未設定の任意フィールドはコントロールを空表示し、入力があるまでキーを追加しない。
 * スカラーを空に戻すとキーを削除する (boolean の false は保持)。
 * schema.properties に無い既存キーは末尾の「スキーマ外のフィールド」として
 * inferSchema で描画し、ラウンドトリップで失われないようにする。
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

/** トップレベル: object として展開する */
export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  return (
    <div className="sb-schema-form">
      <ObjectFields schema={schema} value={value} onChange={onChange} />
    </div>
  );
}

/** object の各プロパティ + スキーマ外キーを描画する */
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

  // スキーマ外キーだけの推論スキーマ (description などは付かない)
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
          <div className="sb-schema-extra__divider">スキーマ外のフィールド</div>
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

/** 1 フィールド (ラベル + 型に応じたコントロール) を描画する */
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

  // object → ネスト fieldset
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

    // array of all-scalar object → テーブル
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

    // array of scalar → 入力行リスト
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

    // array of nested object (またはそれ以外) → fieldset のリスト
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

  // scalar (string/number/integer/boolean、enum 含む)
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

  // 不明/未対応 → 読み取り専用 JSON フォールバック (値は保持)
  return (
    <div className="sb-field">
      <FieldLabel label={label} required={required} />
      <pre className="sb-json-fallback" aria-label={`${label} (読み取り専用)`}>
        {safeStringify(value)}
      </pre>
      <p className="sb-field__hint">
        この型はフォームで編集できません。テキストタブで編集してください。
      </p>
    </div>
  );
}

/** array of scalar の入力行リスト */
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
    // 空に戻しても配列要素は残す (空文字 / undefined を保持)
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
            ariaLabel={`${i + 1}番目`}
          />
          <button
            type="button"
            className="sb-row-btn sb-row-btn--danger"
            aria-label="削除"
            onClick={() => removeAt(i)}
          >
            削除
          </button>
        </div>
      ))}
      <button type="button" className="sb-link-btn" onClick={add}>
        + 追加
      </button>
    </div>
  );
}

/** array of (nested) object → fieldset のリスト */
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
                aria-label="上へ移動"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="sb-row-btn"
                aria-label="下へ移動"
                disabled={i === values.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="sb-row-btn sb-row-btn--danger"
                aria-label="削除"
                onClick={() => removeAt(i)}
              >
                削除
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
        + 追加
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
    <span className="sb-required" aria-label="必須">
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
