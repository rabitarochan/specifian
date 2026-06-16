/** Panel that displays compile/render errors without crashing the app. */

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
