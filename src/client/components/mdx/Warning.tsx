/** Warning box displayed by built-in components when data is invalid. */
import type { ReactNode } from 'react';

export function Warning({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div
      className="my-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3.5 py-3 text-[#92400e]"
      role="note"
    >
      {title && (
        <strong className="mb-1 block font-semibold">⚠ {title}</strong>
      )}
      <div>{children}</div>
    </div>
  );
}
