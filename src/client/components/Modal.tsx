/** 汎用モーダルダイアログ。Escape / 背景クリック / キャンセルで閉じる */
import { useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sb-modal-backdrop" onClick={onClose}>
      <div
        className="sb-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sb-modal__head">
          <h2 className="sb-modal__title">{title}</h2>
          <button className="sb-icon-btn" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="sb-modal__body">{children}</div>
      </div>
    </div>
  );
}
