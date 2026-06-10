/** コンパイル/描画エラーをアプリを落とさず表示するパネル */

export function ErrorPanel({ title, error }: { title: string; error: Error }) {
  const stack = error.stack?.split('\n').slice(0, 8).join('\n');
  return (
    <div className="sb-error-panel" role="alert">
      <div className="sb-error-panel__title">{title}</div>
      <div className="sb-error-panel__message">{error.message}</div>
      {stack && <pre className="sb-error-panel__stack">{stack}</pre>}
    </div>
  );
}
