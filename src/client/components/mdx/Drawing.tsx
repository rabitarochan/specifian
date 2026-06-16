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
import { Warning } from './Warning';

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
        <div className="sb-drawing sb-drawing--missing">
          <div className="sb-drawing__placeholder">
            <div className="sb-drawing__placeholder-text">
              No drawing yet: <code>{src}</code>
            </div>
            <button className="sb-btn sb-btn--primary" onClick={openEditor}>
              Create drawing
            </button>
          </div>
        </div>
        {editing && (
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
      <div className="sb-mermaid-error" role="alert">
        <div className="sb-mermaid-error__title">Drawing render error: {src}</div>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <>
      <div className="sb-drawing" title={title}>
        {status === 'loading' && (
          <div className="sb-drawing__loading">Loading drawing…</div>
        )}
        <div className="sb-drawing__canvas" ref={containerRef} />
        {status === 'ready' && (
          <button
            className="sb-drawing__edit"
            onClick={openEditor}
            aria-label="Edit drawing"
          >
            Edit
          </button>
        )}
      </div>
      {editing && (
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
