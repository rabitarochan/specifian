/**
 * DB テーブル定義の描画。
 * data 形状: { name, description?, columns: [{ name, type, nullable?, default?, primaryKey?, foreignKey?, description? }] }
 */
import { Warning } from './Warning';

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  default?: unknown;
  primaryKey?: boolean;
  foreignKey?: string;
  description?: string;
}

interface TableData {
  name: string;
  description?: string;
  columns: Column[];
}

function isTableData(v: unknown): v is TableData {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.name === 'string' && Array.isArray(o.columns);
}

export function TableDefinition({ data }: { data?: unknown }) {
  if (!isTableData(data)) {
    return (
      <Warning title="TableDefinition">
        テーブル定義データが不正です (<code>name</code> と <code>columns</code> が必要です)。
      </Warning>
    );
  }

  return (
    <div className="sb-table-def">
      <div className="sb-table-def__head">
        <span className="sb-table-def__name">{data.name}</span>
        {data.description && (
          <span className="sb-table-def__desc">{data.description}</span>
        )}
      </div>
      <table className="sb-table-def__table">
        <thead>
          <tr>
            <th>列名</th>
            <th>型</th>
            <th>NULL</th>
            <th>デフォルト</th>
            <th>キー</th>
            <th>説明</th>
          </tr>
        </thead>
        <tbody>
          {data.columns.map((col, i) => (
            <tr key={col?.name ?? i}>
              <td className="sb-col-name">{col?.name ?? '—'}</td>
              <td className="sb-col-type">{col?.type ?? '—'}</td>
              <td>{col?.nullable ? 'YES' : 'NO'}</td>
              <td>
                {col?.default === undefined || col?.default === null
                  ? '—'
                  : String(col.default)}
              </td>
              <td className="sb-col-key">
                {col?.primaryKey && <span className="sb-badge sb-badge--pk">PK</span>}
                {col?.foreignKey && (
                  <span className="sb-badge sb-badge--fk" title={col.foreignKey}>
                    FK
                  </span>
                )}
              </td>
              <td>{col?.description ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
