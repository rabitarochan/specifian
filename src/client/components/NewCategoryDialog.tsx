/** Dialog for creating a new category. */
import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { createCategory } from '../api';
import { ApiHttpError } from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-cat-path">Category path</Label>
          <Input
            id="new-cat-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="tables / api/v1"
            autoFocus
          />
          <span className="text-xs text-muted-foreground">
            Use <code>/</code> to nest, e.g. <code>api/v1</code>.
          </span>
        </div>
        {error && <p className="text-destructive text-[13px] m-0">{error}</p>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
