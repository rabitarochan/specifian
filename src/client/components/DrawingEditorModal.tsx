/**
 * Opens the Excalidraw editor in a near-fullscreen modal.
 * - Normalizes initialScene via restore() and passes it to initialData
 * - Save: serializeAsJSON → JSON.parse → saveDrawing → toast → onSaved → close
 * - Cancel / Escape / ✕ discards changes and closes
 *
 * The Excalidraw library is loaded dynamically only when this component mounts
 * (via excalidrawModule's loadExcalidraw).
 */
import { useEffect, useRef, useState } from 'react';
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import { loadExcalidraw, restoreScene } from '../excalidraw/excalidrawModule';
import { saveDrawing } from '../api';
import { useToast } from './Toast';

type ExcalidrawComponent = (typeof import('@excalidraw/excalidraw'))['Excalidraw'];
type SerializeAsJSON =
  (typeof import('@excalidraw/excalidraw'))['serializeAsJSON'];

interface Props {
  /** Path relative to specsDir, without extension (e.g. "screens/login") */
  src: string;
  /** Pre-fetched scene (null for new drawings) */
  initialScene: unknown | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DrawingEditorModal({
  src,
  initialScene,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const [Excalidraw, setExcalidraw] = useState<ExcalidrawComponent | null>(null);
  const [serialize, setSerialize] = useState<{ fn: SerializeAsJSON } | null>(
    null,
  );
  const [initialData, setInitialData] =
    useState<ExcalidrawInitialDataState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load the Excalidraw library and prepare initialData
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const mod = await loadExcalidraw();
        // Normalize via restore so hand-written / partial scenes open safely
        const restored = await restoreScene(initialScene ?? {});
        if (cancelled) return;
        setExcalidraw(() => mod.Excalidraw);
        setSerialize({ fn: mod.serializeAsJSON });
        setInitialData({
          elements: restored.elements,
          appState: restored.appState,
          files: restored.files,
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialScene]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    const api = apiRef.current;
    if (!api || !serialize) return;
    setSaving(true);
    setSaveError(null);
    try {
      const json = serialize.fn(
        api.getSceneElements(),
        api.getAppState(),
        api.getFiles(),
        'local',
      );
      const scene = JSON.parse(json) as unknown;
      await saveDrawing(src, scene);
      toast.show('Saved');
      onSaved();
      onClose();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <div className="sb-modal-backdrop" onClick={onClose}>
      <div
        className="sb-drawing-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit drawing: ${src}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sb-drawing-modal__head">
          <h2 className="sb-drawing-modal__title">{src}</h2>
          <div className="sb-drawing-modal__actions">
            {saveError && (
              <span className="sb-drawing-modal__error">{saveError}</span>
            )}
            <button
              className="sb-btn sb-btn--primary"
              onClick={() => void handleSave()}
              disabled={!Excalidraw || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="sb-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className="sb-icon-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="sb-drawing-modal__body">
          {loadError ? (
            <div className="sb-mermaid-error" role="alert">
              <div className="sb-mermaid-error__title">
                Failed to load editor
              </div>
              <pre>{loadError}</pre>
            </div>
          ) : Excalidraw && initialData ? (
            <Excalidraw
              initialData={initialData}
              langCode="en-US"
              excalidrawAPI={(api) => {
                apiRef.current = api;
              }}
            />
          ) : (
            <div className="sb-drawing-modal__loading">
              Loading editor…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
