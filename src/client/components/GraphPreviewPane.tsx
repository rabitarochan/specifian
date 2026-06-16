/**
 * Preview shown in the right pane when a graph node is selected.
 * - Header: title + ID badge + "Open page" + ✕ close
 * - Body: MDX fetched via fetchSpec rendered by MdxRenderer (.sb-content-style padding)
 * - State: loading / fetch error; re-fetches when selected changes (stale results discarded)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpecDetail } from '@shared/types';
import { parseSpecId, specRoute } from '@shared/types';
import { fetchSpec, ApiHttpError } from '../api';
import { useSpecs } from './SpecsProvider';
import { MdxRenderer } from './MdxRenderer';

interface Props {
  /** ID of the selected spec ("tables:users") */
  id: string;
  /** Title resolved by the graph (shown in the header before fetch completes) */
  title: string;
  onClose: () => void;
  /** Switch the selected spec via wiki links inside the preview */
  onSelect: (id: string) => void;
}

export function GraphPreviewPane({ id, title, onClose, onSelect }: Props) {
  const navigate = useNavigate();
  const { specs } = useSpecs();
  const parsed = parseSpecId(id);

  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed) {
      setDetail(null);
      setError('Invalid spec ID.');
      return;
    }
    let active = true;
    setDetail(null);
    setError(null);
    fetchSpec(parsed.category, parsed.slug)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg =
          err instanceof ApiHttpError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load.';
        setError(msg);
      });
    return () => {
      active = false;
    };
    // Re-fetch when category / slug changes
  }, [parsed?.category, parsed?.slug]);

  const headerTitle = detail?.meta.title ?? title;

  return (
    <div className="sb-graph-preview">
      <header className="sb-graph-preview__header">
        <span className="sb-graph-preview__title" title={headerTitle}>
          {headerTitle}
        </span>
        <span className="sb-id-badge">{id}</span>
        <div className="sb-graph-preview__actions">
          <button
            className="sb-btn sb-btn--primary"
            onClick={() => navigate(specRoute(id))}
          >
            Open page
          </button>
          <button
            className="sb-icon-btn"
            onClick={onClose}
            aria-label="Close preview"
            title="Close"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="sb-graph-preview__body">
        {error ? (
          <div className="sb-error-panel" role="alert">
            <div className="sb-error-panel__title">Load Error</div>
            <div className="sb-error-panel__message">{error}</div>
          </div>
        ) : !detail || !parsed ? (
          <div className="sb-loading">Loading…</div>
        ) : (
          <MdxRenderer
            content={detail.content}
            specs={specs}
            category={parsed.category}
            slug={parsed.slug}
            onWikiNavigate={onSelect}
          />
        )}
      </div>
    </div>
  );
}
