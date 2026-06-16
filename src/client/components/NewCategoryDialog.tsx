/** Dialog for creating a new category. */
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
      setError('Please enter a category path.');
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
          ? 'That category already exists.'
          : err instanceof Error
            ? err.message
            : 'Failed to create.';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal title="New Category" onClose={onClose}>
      <form onSubmit={submit} className="sb-form">
        <label className="sb-field">
          <span className="sb-field__label">Category path</span>
          <input
            className="sb-input"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="tables / api/v1"
            autoFocus
          />
          <span className="sb-field__hint">
            Use <code>/</code> to nest, e.g. <code>api/v1</code>.
          </span>
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
