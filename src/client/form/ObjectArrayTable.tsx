/**
 * array-of-(all-scalar)-object 用の編集テーブル (本機能の主役)。
 * - 1 列 = 1 プロパティ (ヘッダー = title ?? key、required は * 付き)
 * - 1 行 = 配列の 1 要素 (オブジェクト)
 * - セルはコンパクト入力 (boolean=checkbox / enum=select / それ以外=text|number)
 * - 行操作: ↑ ↓ 削除、フッターに「+ 行を追加」
 */
import type { JsonSchema } from './schemaTypes';
import { ScalarControl } from './ScalarControl';
import {
  asRecord,
  cloneValue,
  fieldLabel,
  isRequired,
  omitKey,
  setKey,
} from './formUtils';

interface Props {
  /** array スキーマ (items は all-scalar object) */
  schema: JsonSchema;
  /** 配列値 */
  rows: unknown[];
  onChange: (next: unknown[]) => void;
}

export function ObjectArrayTable({ schema, rows, onChange }: Props) {
  const items = schema.items ?? {};
  const props = items.properties ?? {};
  const columns = Object.keys(props);

  const updateCell = (
    rowIndex: number,
    key: string,
    next: unknown,
  ): void => {
    const row = asRecord(rows[rowIndex]);
    const nextRow =
      next === undefined ? omitKey(row, key) : setKey(row, key, next);
    const nextRows = rows.slice();
    nextRows[rowIndex] = nextRow;
    onChange(nextRows);
  };

  const removeRow = (rowIndex: number): void => {
    const nextRows = rows.slice();
    nextRows.splice(rowIndex, 1);
    onChange(nextRows);
  };

  const moveRow = (rowIndex: number, dir: -1 | 1): void => {
    const target = rowIndex + dir;
    if (target < 0 || target >= rows.length) return;
    const nextRows = rows.slice();
    const [moved] = nextRows.splice(rowIndex, 1);
    nextRows.splice(target, 0, moved);
    onChange(nextRows);
  };

  const addRow = (): void => {
    const newRow: Record<string, unknown> = {};
    // 列の default のみ初期化 (空値はキー未設定のまま残す)
    for (const key of columns) {
      const colSchema = props[key];
      if (colSchema.default !== undefined) {
        newRow[key] = cloneValue(colSchema.default);
      }
    }
    onChange([...rows, newRow]);
  };

  return (
    <div className="sb-table-widget">
      <div className="sb-table-widget__scroll">
        <table className="sb-table-widget__table">
          <thead>
            <tr>
              {columns.map((key) => {
                const colSchema = props[key];
                return (
                  <th key={key}>
                    {fieldLabel(colSchema, key)}
                    {isRequired(items, key) && (
                      <span className="sb-required" aria-hidden="true">
                        {' '}
                        *
                      </span>
                    )}
                  </th>
                );
              })}
              <th className="sb-table-widget__actions-head" aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="sb-table-widget__empty"
                  colSpan={columns.length + 1}
                >
                  行がありません
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                const record = asRecord(row);
                return (
                  <tr key={rowIndex}>
                    {columns.map((key) => {
                      const colSchema = props[key];
                      const required = isRequired(items, key);
                      return (
                        <td key={key}>
                          <ScalarControl
                            schema={colSchema}
                            value={record[key]}
                            allowEmpty={!required}
                            compact
                            ariaLabel={`${fieldLabel(colSchema, key)} (${rowIndex + 1}行目)`}
                            onChange={(next) =>
                              updateCell(rowIndex, key, next)
                            }
                          />
                        </td>
                      );
                    })}
                    <td className="sb-table-widget__actions">
                      <button
                        type="button"
                        className="sb-row-btn"
                        title="上へ"
                        aria-label="上へ移動"
                        disabled={rowIndex === 0}
                        onClick={() => moveRow(rowIndex, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="sb-row-btn"
                        title="下へ"
                        aria-label="下へ移動"
                        disabled={rowIndex === rows.length - 1}
                        onClick={() => moveRow(rowIndex, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="sb-row-btn sb-row-btn--danger"
                        title="削除"
                        aria-label="行を削除"
                        onClick={() => removeRow(rowIndex)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="sb-table-widget__footer">
        <button type="button" className="sb-link-btn" onClick={addRow}>
          + 行を追加
        </button>
      </div>
    </div>
  );
}
