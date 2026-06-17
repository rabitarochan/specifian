/** Panel that displays compile/render errors without crashing the app. */

export function ErrorPanel({ title, error }: { title: string; error: Error }) {
  const stack = error.stack?.split('\n').slice(0, 8).join('\n');
  return (
    <div
      className="border border-[#fecaca] bg-[#fef2f2] rounded-lg px-4 py-3.5 my-4"
      role="alert"
    >
      <div className="font-bold text-destructive mb-1">{title}</div>
      <div className="font-mono text-[13px] text-[#991b1b] whitespace-pre-wrap">
        {error.message}
      </div>
      {stack && (
        <pre className="mt-2.5 text-[12px] text-[#7f1d1d] bg-white border border-[#fecaca] rounded px-2 py-2 overflow-x-auto">
          {stack}
        </pre>
      )}
    </div>
  );
}
