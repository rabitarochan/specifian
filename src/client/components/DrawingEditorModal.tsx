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
import { X } from 'lucide-react';
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import { loadExcalidraw, restoreScene } from '../excalidraw/excalidrawModule';
import { saveDrawing } from '../api';
import { useToast } from './Toast';
import { Button } from '@/components/ui/button';

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
    <div
      className="fixed inset-0 bg-foreground/45 flex items-center justify-center z-[900] p-5"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-[94vw] h-[88vh] max-w-[94vw] bg-background rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.25)] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit drawing: ${src}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-[15px] font-bold m-0 font-mono text-foreground truncate">
            {src}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {saveError && (
              <span className="text-destructive text-xs max-w-[320px] truncate">
                {saveError}
              </span>
            )}
            <Button
              onClick={() => void handleSave()}
              disabled={!Excalidraw || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
            >
              <X />
            </Button>
          </div>
        </div>
        <div className="relative flex-1 min-h-0 [&_.excalidraw]:size-full">
          {loadError ? (
            <div
              className="my-[1.2em] p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg"
              role="alert"
            >
              <div className="font-semibold text-[#b91c1c] mb-1.5">
                Failed to load editor
              </div>
              <pre className="bg-transparent text-[#7f1d1d] p-0 m-0 text-xs">
                {loadError}
              </pre>
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
            <div className="flex items-center justify-center h-full text-muted-foreground text-[13px]">
              Loading editor…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
