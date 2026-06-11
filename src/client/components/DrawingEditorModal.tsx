/**
 * Excalidraw エディターをフルスクリーン寄りのモーダルで開く。
 * - initialScene を restore() で正規化して initialData に渡す
 * - 保存: serializeAsJSON → JSON.parse → saveDrawing → トースト → onSaved → 閉じる
 * - キャンセル / Escape / ✕ で破棄して閉じる
 *
 * Excalidraw 本体は本コンポーネントが描画されたときだけ動的にロードされる
 * (excalidrawModule の loadExcalidraw 経由)。
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
  /** specsDir 相対・拡張子なしパス (例: "screens/login") */
  src: string;
  /** 取得済みシーン (新規の場合は null) */
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

  // Excalidraw 本体のロードと initialData の準備
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const mod = await loadExcalidraw();
        // 手書き / 部分シーンも安全に開けるよう restore で正規化する
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

  // Escape で閉じる
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
      toast.show('保存しました');
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
        aria-label={`図の編集: ${src}`}
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
              {saving ? '保存中…' : '保存'}
            </button>
            <button className="sb-btn" onClick={onClose} disabled={saving}>
              キャンセル
            </button>
            <button
              className="sb-icon-btn"
              onClick={onClose}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>
        <div className="sb-drawing-modal__body">
          {loadError ? (
            <div className="sb-mermaid-error" role="alert">
              <div className="sb-mermaid-error__title">
                エディターの読み込みに失敗しました
              </div>
              <pre>{loadError}</pre>
            </div>
          ) : Excalidraw && initialData ? (
            <Excalidraw
              initialData={initialData}
              langCode="ja-JP"
              excalidrawAPI={(api) => {
                apiRef.current = api;
              }}
            />
          ) : (
            <div className="sb-drawing-modal__loading">
              エディターを読み込み中…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
