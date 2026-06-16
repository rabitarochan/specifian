/**
 * Editable table for array-of-(all-scalar)-object (the primary widget for this pattern).
 * - 1 column = 1 property (header = title ?? key; required marked with *)
 * - 1 row = 1 array element (object)
 * - Cells use compact inputs (boolean=checkbox / enum=select / else=text|number)
 * - Row actions: ↑ ↓ Delete; footer has "+ Add row"
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
  /** Array schema (items must be an all-scalar object) */
  schema: JsonSchema;
  /** Array value */
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
    // Initialize only column defaults (leave unset keys empty)
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
              <th className="sb-table-widget__actions-head" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="sb-table-widget__empty"
                  colSpan={columns.length + 1}
                >
                  No rows
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
                            ariaLabel={`${fieldLabel(colSchema, key)} (row ${rowIndex + 1})`}
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
                        title="Move up"
                        aria-label="Move up"
                        disabled={rowIndex === 0}
                        onClick={() => moveRow(rowIndex, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="sb-row-btn"
                        title="Move down"
                        aria-label="Move down"
                        disabled={rowIndex === rows.length - 1}
                        onClick={() => moveRow(rowIndex, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="sb-row-btn sb-row-btn--danger"
                        title="Delete"
                        aria-label="Delete row"
                        onClick={() => removeRow(rowIndex)}
                      >
                        Delete
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
          + Add row
        </button>
      </div>
    </div>
  );
}
