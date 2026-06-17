/**
 * Preview shown in the right pane when a graph node is selected.
 * - Header: title + ID badge + "Open page" + ✕ close
 * - Body: MDX fetched via fetchSpec rendered by MdxRenderer (.sb-content-style padding)
 * - State: loading / fetch error; re-fetches when selected changes (stale results discarded)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import type { SpecDetail } from '@shared/types';
import { parseSpecId, specRoute } from '@shared/types';
import { fetchSpec, ApiHttpError } from '../api';
import { useSpecs } from './SpecsProvider';
import { MdxRenderer } from './MdxRenderer';
import { Button } from '@/components/ui/button';

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
    <div className="w-1/2 min-w-0 border-l border-border flex flex-col">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <span
          className="font-bold text-[15px] truncate min-w-0"
          title={headerTitle}
        >
          {headerTitle}
        </span>
        <span className="font-mono text-xs text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 shrink-0">
          {id}
        </span>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Button onClick={() => navigate(specRoute(id))}>Open page</Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close preview"
            title="Close"
          >
            <X />
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-7 py-6">
        {error ? (
          <div
            className="border border-[#fecaca] bg-[#fef2f2] rounded-lg px-4 py-3.5 my-4"
            role="alert"
          >
            <div className="font-bold text-destructive mb-1">Load Error</div>
            <div className="font-mono text-[13px] text-[#991b1b] whitespace-pre-wrap">
              {error}
            </div>
          </div>
        ) : !detail || !parsed ? (
          <div className="p-10 text-muted-foreground">Loading…</div>
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
