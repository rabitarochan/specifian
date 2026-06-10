/**
 * テーブル定義のカラム数を集計して表示するサンプルコンポーネント。
 *
 * front-matter (data.table) を props で受け取り、
 *   「全 N カラム / うち NOT NULL M」
 * を計算して表示します。さらに useState のトグルで NULL 許可カラム名の
 * 表示/非表示を切り替えられ、_components 内でも React フックが動くことを示します。
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
  // nullable が false / 未指定なら NOT NULL とみなす
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
        全 <strong>{total}</strong> カラム / うち NOT NULL{' '}
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
            {open ? 'NULL 許可カラムを隠す' : `NULL 許可カラムを表示 (${nullableNames.length})`}
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
