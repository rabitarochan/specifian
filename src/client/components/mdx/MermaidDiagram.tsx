/**
 * ```mermaid フェンスを SVG に描画する。
 * mermaid 本体は dynamic import でメインバンドルから分離する。
 * 描画エラーはアプリを落とさずエラーボックスとして表示する。
 */
import { useEffect, useRef, useState } from 'react';

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid(): Promise<typeof import('mermaid').default> {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      return mermaid;
    });
  }
  return mermaidReady;
}

let idSeq = 0;

export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 同一コードの再描画を避けるための識別子 (描画ごとに固定)
  const idRef = useRef<string>(`mmd-${(idSeq += 1)}`);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadMermaid()
      .then((mermaid) => mermaid.render(idRef.current, code))
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="sb-mermaid-error" role="alert">
        <div className="sb-mermaid-error__title">Mermaid 描画エラー</div>
        <pre>{error}</pre>
      </div>
    );
  }
  if (svg === null) {
    return <div className="sb-mermaid sb-mermaid--loading">図を描画中…</div>;
  }
  return (
    <div
      className="sb-mermaid"
      // mermaid が生成する SVG を埋め込む
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
