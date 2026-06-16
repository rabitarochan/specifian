/**
 * Sample component that aggregates and displays the column count of a table definition.
 *
 * Receives front-matter (data.table) as a prop and computes:
 *   "Total N columns / NOT NULL M"
 * It also uses a useState toggle to show/hide the names of nullable columns,
 * demonstrating that React hooks work inside _components.
 */
import * as React from 'react';

interface Column {
  name: string;
  nullable?: boolean;
}

interface TableLike {
  columns?: Column[];
}

export default function ColumnCount({ table }: { table: TableLike }) {
  const [open, setOpen] = React.useState(false);

  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const total = columns.length;
  // Treat a column as NOT NULL if nullable is false or unspecified
  const notNull = columns.filter((c) => c?.nullable !== true).length;
  const nullableNames = columns
    .filter((c) => c?.nullable === true)
    .map((c) => c?.name)
    .filter(Boolean);

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px 12px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        fontSize: '0.875rem',
        backgroundColor: '#f9fafb',
      }}
    >
      <div>
        Total <strong>{total}</strong> columns / NOT NULL{' '}
        <strong>{notNull}</strong>
      </div>
      {nullableNames.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              padding: '2px 8px',
              fontSize: '0.8125rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#fff',
              cursor: 'pointer',
            }}
          >
            {open ? 'Hide nullable columns' : `Show nullable columns (${nullableNames.length})`}
          </button>
          {open && (
            <ul style={{ margin: '6px 0 0', paddingLeft: '1.2em' }}>
              {nullableNames.map((name) => (
                <li key={name}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
