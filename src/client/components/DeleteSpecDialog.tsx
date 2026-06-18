/** Dialog for deleting a spec. Checks incoming references before asking for confirmation. */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from './Modal';
import { deleteSpecById, fetchRefs, ApiHttpError } from '../api';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { parseSpecId } from '@shared/types';
import { Button } from '@/components/ui/button';

interface Props {
  /** ID of the spec to delete ("category:slug") */
  specId: string;
  onClose: () => void;
}

export function DeleteSpecDialog({ specId, onClose }: Props) {
  const parsed = parseSpecId(specId);
  const { refetch } = useSpecs();
  const { show } = useToast();
  const navigate = useNavigate();
  const params = useParams<{ '*': string }>();

  const [refs, setRefs] = useState<string[] | null>(null);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch incoming references when the dialog opens
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchRefs(specId);
        if (!cancelled) setRefs(res.refs);
      } catch (err) {
        if (!cancelled) {
          setRefsError(err instanceof Error ? err.message : 'Failed to fetch references.');
          setRefs([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [specId]);

  const doDelete = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSpecById(parsed.category, parsed.slug);
      await refetch();
      show('Deleted');

      // Navigate home if the currently viewed spec was deleted
      const currentSplat = params['*'] ?? '';
      const expectedSplat = `${parsed.category}/${parsed.slug}`;
      if (currentSplat === expectedSplat) {
        navigate('/', { replace: true });
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiHttpError && err.status === 404
          ? 'Spec not found.'
          : err instanceof Error
            ? err.message
            : 'Failed to delete.';
      setError(msg);
      setBusy(false);
    }
  };

  const loading = refs === null && refsError === null;

  return (
    <Modal title="Delete Spec" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <p className="m-0">
          Delete spec{' '}
          <span className="font-mono text-xs text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
            {specId}
          </span>
          ?
        </p>

        {loading && (
          <p className="text-muted-foreground text-[13px] m-0">
            Checking references…
          </p>
        )}

        {refsError && (
          <p className="text-destructive text-[13px] m-0">
            Failed to fetch references: {refsError}
          </p>
        )}

        {refs !== null && refs.length > 0 && (
          <div className="border border-[#fde68a] bg-[#fffbeb] rounded-lg px-3.5 py-2.5 text-[#92400e] text-[13.5px]">
            <strong className="block font-semibold mb-1.5">
              This spec is referenced by {refs.length} other spec{refs.length !== 1 ? 's' : ''}.
              Deleting it will break those links:
            </strong>
            <ul className="m-0 pl-[1.2em] flex flex-col gap-1">
              {refs.map((r) => (
                <li key={r}>
                  <span className="font-mono text-xs text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                    {r}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-destructive text-[13px] m-0">{error}</p>}

        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void doDelete()}
            disabled={busy || loading}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
