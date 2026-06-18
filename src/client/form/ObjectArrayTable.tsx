/**
 * Editable table for array-of-(all-scalar)-object (the primary widget for this pattern).
 * - 1 column = 1 property (header = title ?? key; required marked with *)
 * - 1 row = 1 array element (object)
 * - Cells use compact inputs (boolean=checkbox / enum=select / else=text|number)
 * - Row actions: ↑ ↓ Delete; footer has "+ Add row"
 */
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="border-collapse w-full text-[13px]">
          <thead>
            <tr>
              {columns.map((key) => {
                const colSchema = props[key];
                return (
                  <th
                    key={key}
                    className="bg-muted font-semibold text-[12px] text-muted-foreground text-left px-2.5 py-[7px] border-b border-border whitespace-nowrap"
                  >
                    {fieldLabel(colSchema, key)}
                    {isRequired(items, key) && (
                      <span className="text-destructive font-bold" aria-hidden="true">
                        {' '}
                        *
                      </span>
                    )}
                  </th>
                );
              })}
              <th
                className="w-[1%] bg-muted font-semibold text-[12px] text-muted-foreground text-left px-2.5 py-[7px] border-b border-border whitespace-nowrap"
                aria-label="Actions"
              />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="text-center text-muted-foreground text-[12.5px] p-3"
                  colSpan={columns.length + 1}
                >
                  No rows
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                const record = asRecord(row);
                const isLast = rowIndex === rows.length - 1;
                return (
                  <tr key={rowIndex}>
                    {columns.map((key) => {
                      const colSchema = props[key];
                      const required = isRequired(items, key);
                      return (
                        <td
                          key={key}
                          className={cn(
                            'px-1.5 py-0.5 border-b border-border align-middle',
                            isLast && 'border-b-0',
                          )}
                        >
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
                    <td
                      className={cn(
                        'whitespace-nowrap text-right px-1.5 py-0.5 border-b border-border align-middle',
                        isLast && 'border-b-0',
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move up"
                        aria-label="Move up"
                        disabled={rowIndex === 0}
                        onClick={() => moveRow(rowIndex, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move down"
                        aria-label="Move down"
                        disabled={rowIndex === rows.length - 1}
                        onClick={() => moveRow(rowIndex, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        aria-label="Delete row"
                        className="hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeRow(rowIndex)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="px-2.5 py-[7px] border-t border-border bg-muted">
        <button
          type="button"
          className="font-[inherit] border-none bg-transparent text-primary cursor-pointer px-1 underline"
          onClick={addRow}
        >
          + Add row
        </button>
      </div>
    </div>
  );
}
