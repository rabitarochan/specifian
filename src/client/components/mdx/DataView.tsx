/** Displays an object or array as a collapsible, formatted JSON view. */

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  switch (typeof value) {
    case 'string':
      return <span className="text-[#16a34a]">"{value}"</span>;
    case 'number':
      return <span className="text-[#ca8a04]">{value}</span>;
    case 'boolean':
      return <span className="text-[#9333ea]">{String(value)}</span>;
    default:
      return <span className="text-muted-foreground">{String(value)}</span>;
  }
}

function Node({ name, value }: { name?: string; value: unknown }) {
  const label = name !== undefined ? <span className="text-primary">{name}: </span> : null;

  if (Array.isArray(value)) {
    if (value.length === 0)
      return (
        <div className="pl-4">
          {label}
          <span className="text-muted-foreground">[]</span>
        </div>
      );
    return (
      <details className="ml-0 [&>summary]:cursor-pointer [&>summary]:list-item" open>
        <summary>
          {label}
          <span className="text-muted-foreground">[{value.length}]</span>
        </summary>
        <div className="ml-1 border-l border-border pl-4">
          {value.map((v, i) => (
            <Node key={i} name={String(i)} value={v} />
          ))}
        </div>
      </details>
    );
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0)
      return (
        <div className="pl-4">
          {label}
          <span className="text-muted-foreground">{'{}'}</span>
        </div>
      );
    return (
      <details className="ml-0 [&>summary]:cursor-pointer [&>summary]:list-item" open>
        <summary>
          {label}
          <span className="text-muted-foreground">{'{…}'}</span>
        </summary>
        <div className="ml-1 border-l border-border pl-4">
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="pl-4">
      {label}
      <Primitive value={value} />
    </div>
  );
}

export function DataView({ data }: { data?: unknown }) {
  return (
    <div className="my-4 rounded-lg border border-border bg-muted px-3.5 py-3 font-mono text-[13px] leading-[1.6]">
      <Node value={data} />
    </div>
  );
}
