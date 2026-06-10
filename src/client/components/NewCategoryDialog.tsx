/** 新しいカテゴリーを作成するダイアログ */
import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { createCategory } from '../api';
import { ApiHttpError } from '../api';

interface Props {
  onClose: () => void;
  onCreated: (path: string) => void;
}

export function NewCategoryDialog({ onClose, onCreated }: Props) {
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = path.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmed) {
      setError('カテゴリーのパスを入力してください。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCategory({ path: trimmed });
      onCreated(trimmed);
    } catch (err) {
      const msg =
        err instanceof ApiHttpError && err.status === 409
          ? 'そのカテゴリーは既に存在します。'
          : err instanceof Error
            ? err.message
            : '作成に失敗しました。';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal title="新しいカテゴリー" onClose={onClose}>
      <form onSubmit={submit} className="sb-form">
        <label className="sb-field">
          <span className="sb-field__label">カテゴリーのパス</span>
          <input
            className="sb-input"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="tables / api/v1"
            autoFocus
          />
          <span className="sb-field__hint">
            ネストする場合は <code>api/v1</code> のように <code>/</code> で区切ります。
          </span>
        </label>
        {error && <p className="sb-form__error">{error}</p>}
        <div className="sb-form__actions">
          <button type="button" className="sb-btn" onClick={onClose} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={busy}>
            作成
          </button>
        </div>
      </form>
    </Modal>
  );
}
