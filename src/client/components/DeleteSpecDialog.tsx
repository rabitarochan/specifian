/** Dialog for deleting a spec. Checks incoming references before asking for confirmation. */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from './Modal';
import { deleteSpecById, fetchRefs, ApiHttpError } from '../api';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { parseSpecId } from '@shared/types';

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
      <div className="sb-form">
        <p style={{ margin: 0 }}>
          Delete spec <span className="sb-id-badge">{specId}</span>?
        </p>

        {loading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Checking references…
          </p>
        )}

        {refsError && (
          <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>
            Failed to fetch references: {refsError}
          </p>
        )}

        {refs !== null && refs.length > 0 && (
          <div className="sb-delete-warning">
            <strong className="sb-delete-warning__title">
              This spec is referenced by {refs.length} other spec{refs.length !== 1 ? 's' : ''}.
              Deleting it will break those links:
            </strong>
            <ul className="sb-delete-warning__list">
              {refs.map((r) => (
                <li key={r}>
                  <span className="sb-id-badge">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="sb-form__error">{error}</p>}

        <div className="sb-form__actions">
          <button type="button" className="sb-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="sb-btn sb-btn--danger"
            onClick={() => void doDelete()}
            disabled={busy || loading}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
