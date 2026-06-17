/**
 * MDX built-in component `<Drawing src="screens/login" />`.
 * - Fetches the scene and renders a static SVG via Excalidraw's exportToSvg (no editor in view mode)
 * - Hover shows an "Edit" button → opens DrawingEditorModal
 * - Shows a placeholder + "Create drawing" button when the file doesn't exist (404)
 * - Automatically re-renders when the file changes externally (e.g. via VSCode)
 *
 * The Excalidraw library is loaded dynamically only when rendering / editing is needed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiHttpError, fetchDrawing } from '../../api';
import { renderSceneSvg } from '../../excalidraw/excalidrawModule';
import { useSpecs } from '../SpecsProvider';
import { DrawingEditorModal } from '../DrawingEditorModal';
import { Button } from '@/components/ui/button';
import { Warning } from './Warning';
import { READONLY } from '../../env';

interface Props {
  /** Path relative to specsDir, without extension (e.g. "screens/login") */
  src?: string;
  title?: string;
}

type Status = 'loading' | 'ready' | 'missing' | 'error';

export function Drawing({ src, title }: Props) {
  // MDX is user input: missing / empty src shows a friendly warning box
  const trimmed = src?.trim();
  if (!trimmed) {
    return (
      <Warning title="Drawing">
        No drawing path specified (<code>src</code> is required).
      </Warning>
    );
  }
  return <DrawingInner src={trimmed} title={title} />;
}

function DrawingInner({ src, title }: { src: string; title?: string }) {
  const { onFsEvent } = useSpecs();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Pre-fetched scene to pass to the editor modal (null on 404)
  const sceneRef = useRef<unknown | null>(null);
  // Generation counter. Only the latest load call may write state
  // (prevents stale writes from duplicate fs-event re-fetches or after unmount).
  const genRef = useRef(0);

  // Fetch the scene and render to SVG. Discard stale results.
  const load = useCallback(async () => {
    const gen = ++genRef.current;
    const fresh = () => gen === genRef.current;
    setStatus('loading');
    setError(null);
    let scene: unknown;
    try {
      scene = await fetchDrawing(src);
    } catch (err: unknown) {
      if (!fresh()) return;
      if (err instanceof ApiHttpError && err.status === 404) {
        sceneRef.current = null;
        setStatus('missing');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      return;
    }
    if (!fresh()) return;
    sceneRef.current = scene;
    try {
      const svg = await renderSceneSvg(scene);
      if (!fresh()) return;
      const host = containerRef.current;
      if (host) {
        host.replaceChildren(svg);
      }
      setStatus('ready');
    } catch (err: unknown) {
      if (!fresh()) return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [src]);

  // Fetch on mount and when src changes. Advance generation on unmount to discard results.
  useEffect(() => {
    void load();
    return () => {
      genRef.current++;
    };
  }, [load]);

  // Re-fetch when this file's .excalidraw changes via fs event
  useEffect(() => {
    const target = `${src}.excalidraw`;
    return onFsEvent((e) => {
      if (e.path === target) void load();
    });
  }, [src, onFsEvent, load]);

  const openEditor = () => setEditing(true);

  if (status === 'missing') {
    return (
      <>
        <div className="my-[1.2em] overflow-x-auto rounded-lg border border-dashed border-input bg-muted px-4 py-4">
          <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
            <div className="text-[14px] text-muted-foreground">
              No drawing yet: <code>{src}</code>
            </div>
            {!READONLY && (
              <Button variant="default" size="sm" onClick={openEditor}>
                Create drawing
              </Button>
            )}
          </div>
        </div>
        {!READONLY && editing && (
          <DrawingEditorModal
            src={src}
            initialScene={null}
            onClose={() => setEditing(false)}
            onSaved={() => void load()}
          />
        )}
      </>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="my-[1.2em] rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3"
        role="alert"
      >
        <div className="mb-1.5 font-semibold text-[#b91c1c]">Drawing render error: {src}</div>
        <pre className="m-0 bg-transparent p-0 text-[12px] text-[#7f1d1d]">{error}</pre>
      </div>
    );
  }

  return (
    <>
      <div
        className="group relative my-[1.2em] overflow-x-auto rounded-lg border border-border bg-background px-4 py-4"
        title={title}
      >
        {status === 'loading' && (
          <div className="text-[13px] text-muted-foreground">Loading drawing…</div>
        )}
        <div
          className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full"
          ref={containerRef}
        />
        {!READONLY && status === 'ready' && (
          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 top-2 cursor-pointer px-2.5 py-1 text-[12px] opacity-0 transition-opacity duration-[0.12s] ease-[ease] focus-visible:opacity-100 group-hover:opacity-100"
            onClick={openEditor}
            aria-label="Edit drawing"
          >
            Edit
          </Button>
        )}
      </div>
      {!READONLY && editing && (
        <DrawingEditorModal
          src={src}
          initialScene={sceneRef.current}
          onClose={() => setEditing(false)}
          onSaved={() => void load()}
        />
      )}
    </>
  );
}
