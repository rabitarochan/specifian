/** Dialog for creating a new spec in the specified category. */
import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { createSpec, ApiHttpError } from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-spec-slug">Slug (filename)</Label>
          <Input
            id="new-spec-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="users"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-spec-title">Title (optional)</Label>
          <Input
            id="new-spec-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Users"
          />
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
