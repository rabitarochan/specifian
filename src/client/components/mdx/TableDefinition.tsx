/**
 * Renders a DB table definition.
 * data shape: { name, description?, columns: [{ name, type, nullable?, default?, primaryKey?, foreignKey?, description? }] }
 */
import { Badge } from '@/components/ui/badge';
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
        Invalid table definition data (<code>name</code> and <code>columns</code> are required).
      </Warning>
    );
  }

  return (
    <div className="my-[1.2em] overflow-hidden rounded-lg border border-border">
      <div className="flex items-baseline gap-3 border-b border-border bg-muted px-3.5 py-2.5">
        <span className="font-mono text-[15px] font-bold">{data.name}</span>
        {data.description && (
          <span className="text-[13px] text-muted-foreground">{data.description}</span>
        )}
      </div>
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th className="border-b border-border bg-background px-3 py-[7px] text-left text-[12px] font-semibold text-muted-foreground">Column</th>
            <th className="border-b border-border bg-background px-3 py-[7px] text-left text-[12px] font-semibold text-muted-foreground">Type</th>
            <th className="border-b border-border bg-background px-3 py-[7px] text-left text-[12px] font-semibold text-muted-foreground">NULL</th>
            <th className="border-b border-border bg-background px-3 py-[7px] text-left text-[12px] font-semibold text-muted-foreground">Default</th>
            <th className="border-b border-border bg-background px-3 py-[7px] text-left text-[12px] font-semibold text-muted-foreground">Key</th>
            <th className="border-b border-border bg-background px-3 py-[7px] text-left text-[12px] font-semibold text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody>
          {data.columns.map((col, i) => (
            <tr key={col?.name ?? i} className="[&:last-child_td]:border-b-0">
              <td className="border-b border-border px-3 py-[7px] font-mono">{col?.name ?? '—'}</td>
              <td className="border-b border-border px-3 py-[7px] font-mono">{col?.type ?? '—'}</td>
              <td className="border-b border-border px-3 py-[7px]">{col?.nullable ? 'YES' : 'NO'}</td>
              <td className="border-b border-border px-3 py-[7px]">
                {col?.default === undefined || col?.default === null
                  ? '—'
                  : String(col.default)}
              </td>
              <td className="border-b border-border px-3 py-[7px] whitespace-nowrap">
                {col?.primaryKey && <Badge variant="pk" size="xs" className="mr-1">PK</Badge>}
                {col?.foreignKey && (
                  <Badge variant="fk" size="xs" title={col.foreignKey}>
                    FK
                  </Badge>
                )}
              </td>
              <td className="border-b border-border px-3 py-[7px]">{col?.description ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
