/** Warning box displayed by built-in components when data is invalid. */
import type { ReactNode } from 'react';

export function Warning({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="sb-warning" role="note">
      {title && <strong className="sb-warning__title">⚠ {title}</strong>}
      <div className="sb-warning__body">{children}</div>
    </div>
  );
}
