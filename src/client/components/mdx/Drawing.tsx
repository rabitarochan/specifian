/**
 * MDX 組み込みコンポーネント `<Drawing src="screens/login" />`。
 * - シーンを取得し Excalidraw の exportToSvg で静的 SVG 描画 (閲覧時はエディターを起動しない)
 * - ホバーで「編集」ボタン → DrawingEditorModal を開く
 * - ファイルが無い (404) 場合はプレースホルダー + 「図を作成」ボタン
 * - 外部 (VSCode 等) での変更も fs イベントで自動再描画
 *
 * Excalidraw 本体は描画 / 編集が必要になったときだけ動的にロードされる。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiHttpError, fetchDrawing } from '../../api';
import { renderSceneSvg } from '../../excalidraw/excalidrawModule';
import { useSpecs } from '../SpecsProvider';
import { DrawingEditorModal } from '../DrawingEditorModal';
import { Warning } from './Warning';

interface Props {
  /** specsDir 相対・拡張子なしパス (例: "screens/login") */
  src?: string;
  title?: string;
}

type Status = 'loading' | 'ready' | 'missing' | 'error';

export function Drawing({ src, title }: Props) {
  // MDX はユーザー入力: src 欠落 / 空はやさしい警告ボックスにする
  const trimmed = src?.trim();
  if (!trimmed) {
    return (
      <Warning title="Drawing">
        図のパスが指定されていません (<code>src</code> が必要です)。
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
  // 編集モーダルに渡す取得済みシーン (404 のときは null)
  const sceneRef = useRef<unknown | null>(null);
  // 取得世代カウンター。最新の load 呼び出しだけが状態を書き込めるようにする
  // (重複した fs イベント再取得やアンマウント後の stale な書き込みを防ぐ)。
  const genRef = useRef(0);

  // シーンを取得して SVG を描画する。stale な結果は破棄する。
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

  // 初回 + src 変更時に取得。アンマウント時は世代を進めて結果を破棄する。
  useEffect(() => {
    void load();
    return () => {
      genRef.current++;
    };
  }, [load]);

  // fs イベントで自身の .excalidraw が変わったら再取得
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
              図がまだありません: <code>{src}</code>
            </div>
            <button className="sb-btn sb-btn--primary" onClick={openEditor}>
              図を作成
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
        <div className="sb-mermaid-error__title">図の描画エラー: {src}</div>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <>
      <div className="sb-drawing" title={title}>
        {status === 'loading' && (
          <div className="sb-drawing__loading">図を読み込み中…</div>
        )}
        <div className="sb-drawing__canvas" ref={containerRef} />
        {status === 'ready' && (
          <button
            className="sb-drawing__edit"
            onClick={openEditor}
            aria-label="図を編集"
          >
            編集
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
