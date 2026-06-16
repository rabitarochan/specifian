/** Dialog for creating a new spec in the specified category. */
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
      setError('Please enter a slug.');
      return;
    }
    if (s.startsWith('_') || /[\\/]/.test(s)) {
      setError('Slug cannot start with _ or contain slashes.');
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
          ? 'A spec with that slug already exists.'
          : err instanceof Error
            ? err.message
            : 'Failed to create.';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Add spec (${category})`} onClose={onClose}>
      <form onSubmit={submit} className="sb-form">
        <label className="sb-field">
          <span className="sb-field__label">Slug (filename)</span>
          <input
            className="sb-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="users"
            autoFocus
          />
        </label>
        <label className="sb-field">
          <span className="sb-field__label">Title (optional)</span>
          <input
            className="sb-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Users"
          />
        </label>
        {error && <p className="sb-form__error">{error}</p>}
        <div className="sb-form__actions">
          <button type="button" className="sb-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={busy}>
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
