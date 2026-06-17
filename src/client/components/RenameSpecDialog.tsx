/** Dialog for renaming a spec. */
import { useState, useMemo, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from './Modal';
import { renameSpecId, ApiHttpError } from '../api';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { toSpecId, specRoute, parseSpecId } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  /** ID of the spec to rename ("category:slug") */
  specId: string;
  onClose: () => void;
}

/** Valid slug pattern */
const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;
const RESERVED_SLUGS = new Set(['_', '_template', '_guide']);

export function RenameSpecDialog({ specId, onClose }: Props) {
  const parsed = parseSpecId(specId);
  const { specs, refetch } = useSpecs();
  const { show } = useToast();
  const navigate = useNavigate();
  // Determine the currently viewed spec from the "*" splat route param
  const params = useParams<{ '*': string }>();

  const [category, setCategory] = useState(parsed?.category ?? '');
  const [slug, setSlug] = useState(parsed?.slug ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Existing categories used for the sidebar datalist
  const categories = useMemo(
    () => [...new Set(specs.map((s) => s.category))].sort(),
    [specs],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cat = category.trim().replace(/^\/+|\/+$/g, '');
    const sl = slug.trim();

    if (!sl) {
      setError('Please enter a slug.');
      return;
    }
    if (!SLUG_PATTERN.test(sl)) {
      setError('Slug may only contain alphanumeric characters, hyphens, and underscores.');
      return;
    }
    if (RESERVED_SLUGS.has(sl)) {
      setError(`Slug "${sl}" is reserved.`);
      return;
    }
    if (!cat) {
      setError('Please enter a category.');
      return;
    }

    const toId = toSpecId(cat, sl);
    if (toId === specId) {
      onClose();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await renameSpecId(specId, toId);
      await refetch();
      show(`Renamed (${res.rewrittenFiles.length} link${res.rewrittenFiles.length !== 1 ? 's' : ''} updated)`);

      // Navigate to the new route if the currently viewed spec was the one renamed
      const currentSplat = params['*'] ?? '';
      const oldParsed = parseSpecId(specId);
      if (oldParsed) {
        const oldSplat = `${oldParsed.category}/${oldParsed.slug}`;
        if (currentSplat === oldSplat) {
          navigate(specRoute(res.meta.id), { replace: true });
        }
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiHttpError && err.status === 409
          ? 'A spec with that ID already exists.'
          : err instanceof ApiHttpError && err.status === 404
            ? 'Source spec not found.'
            : err instanceof ApiHttpError && err.status === 400
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Failed to rename.';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal title="Rename Spec" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">Current ID</span>
          <span
            className="font-mono text-xs text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 self-start"
          >
            {specId}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rename-category">Category</Label>
          <Input
            id="rename-category"
            list="rename-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="tables"
            autoFocus
            disabled={busy}
          />
          <datalist id="rename-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rename-slug">Slug</Label>
          <Input
            id="rename-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="users"
            pattern="[A-Za-z0-9_\-]+"
            disabled={busy}
          />
          <span className="text-xs text-muted-foreground">Alphanumeric, hyphens, and underscores only</span>
        </div>

        {error && <p className="text-destructive text-[13px] m-0">{error}</p>}

        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Renaming…' : 'Rename'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
