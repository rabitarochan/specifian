/** オブジェクト/配列を折りたたみ可能な整形 JSON ビューで表示する */

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="sb-json-null">null</span>;
  switch (typeof value) {
    case 'string':
      return <span className="sb-json-string">"{value}"</span>;
    case 'number':
      return <span className="sb-json-number">{value}</span>;
    case 'boolean':
      return <span className="sb-json-boolean">{String(value)}</span>;
    default:
      return <span className="sb-json-null">{String(value)}</span>;
  }
}

function Node({ name, value }: { name?: string; value: unknown }) {
  const label = name !== undefined ? <span className="sb-json-key">{name}: </span> : null;

  if (Array.isArray(value)) {
    if (value.length === 0)
      return (
        <div className="sb-json-row">
          {label}
          <span className="sb-json-bracket">[]</span>
        </div>
      );
    return (
      <details className="sb-json-node" open>
        <summary>
          {label}
          <span className="sb-json-bracket">[{value.length}]</span>
        </summary>
        <div className="sb-json-children">
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
        <div className="sb-json-row">
          {label}
          <span className="sb-json-bracket">{'{}'}</span>
        </div>
      );
    return (
      <details className="sb-json-node" open>
        <summary>
          {label}
          <span className="sb-json-bracket">{'{…}'}</span>
        </summary>
        <div className="sb-json-children">
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="sb-json-row">
      {label}
      <Primitive value={value} />
    </div>
  );
}

export function DataView({ data }: { data?: unknown }) {
  return (
    <div className="sb-dataview">
      <Node value={data} />
    </div>
  );
}
