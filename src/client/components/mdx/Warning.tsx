/** 組み込みコンポーネントがデータ不正時に表示する注意ボックス */
import type { ReactNode } from 'react';

export function Warning({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="sb-warning" role="note">
      {title && <strong className="sb-warning__title">⚠ {title}</strong>}
      <div className="sb-warning__body">{children}</div>
    </div>
  );
}
