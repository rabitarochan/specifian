/** 指定カテゴリーに新しいスペックを作成するダイアログ */
import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { createSpec, ApiHttpError } from '../api';

interface Props {
  category: string;
  onClose: () => void;
  onCreated: (category: string, slug: string) => void;
}

export function NewSpecDialog({ category, onClose, onCreated }: Props) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const s = slug.trim();
    if (!s) {
      setError('スラッグを入力してください。');
      return;
    }
    if (s.startsWith('_') || /[\\/]/.test(s)) {
      setError('スラッグに先頭の _ やスラッシュは使えません。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createSpec({ category, slug: s, title: title.trim() || undefined });
      onCreated(category, s);
    } catch (err) {
      const msg =
        err instanceof ApiHttpError && err.status === 409
          ? 'そのスペックは既に存在します。'
          : err instanceof Error
            ? err.message
            : '作成に失敗しました。';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal title={`スペックを追加 (${category})`} onClose={onClose}>
      <form onSubmit={submit} className="sb-form">
        <label className="sb-field">
          <span className="sb-field__label">スラッグ (ファイル名)</span>
          <input
            className="sb-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="users"
            autoFocus
          />
        </label>
        <label className="sb-field">
          <span className="sb-field__label">タイトル (任意)</span>
          <input
            className="sb-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ユーザー"
          />
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
