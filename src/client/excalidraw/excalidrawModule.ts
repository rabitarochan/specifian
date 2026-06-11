/**
 * @excalidraw/excalidraw を遅延ロードするためのモジュールローダー。
 * mermaid と同じく dynamic import でメインバンドルから分離し、
 * Drawing / エディターが実際に表示されたときだけ読み込む。
 *
 * v0.18.1 はスタイルを自己注入しないため `@excalidraw/excalidraw/index.css` を
 * 明示的に import する必要がある (本ファイルの動的 import 内で読み込む)。
 */
type ExcalidrawModule = typeof import('@excalidraw/excalidraw');

let modulePromise: Promise<ExcalidrawModule> | null = null;

/** Excalidraw 本体 (と CSS) を一度だけロードしてキャッシュする */
export function loadExcalidraw(): Promise<ExcalidrawModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // CSS を先に読み込む (v0.18 は自己注入しない)
      await import('@excalidraw/excalidraw/index.css');
      return import('@excalidraw/excalidraw');
    })();
  }
  return modulePromise;
}

/** restore() に渡せる最低限のシーン形状 */
export interface RawScene {
  elements?: unknown;
  appState?: unknown;
  files?: unknown;
}

/**
 * 取得した (手書きの可能性もある) シーンを Excalidraw の restore() で正規化する。
 * 部分的 / 手書きのシーンファイルでも安全に描画・編集できるようにする。
 *
 * 既知の注意点: initialData として渡す場合 appState.collaborators は Map である必要が
 * あるが、restore() の出力は collaborators を含まない正規化済み appState を返すため
 * そのまま initialData に渡しても問題ない (Map 化は不要)。
 */
export async function restoreScene(scene: unknown) {
  const { restore } = await loadExcalidraw();
  const raw = (scene ?? {}) as RawScene;
  // restore は elements/appState/files を受け取り、欠落や不正値を補完する
  return restore(
    {
      elements: (raw.elements as never) ?? [],
      appState: (raw.appState as never) ?? {},
      files: (raw.files as never) ?? {},
    },
    null,
    null,
  );
}

/**
 * シーンを静的 SVG に描画する。閲覧時はエディターを起動せずこれだけを使う。
 * 入力は restore() で正規化してから exportToSvg に渡す。
 */
export async function renderSceneSvg(scene: unknown): Promise<SVGSVGElement> {
  const mod = await loadExcalidraw();
  const restored = await restoreScene(scene);
  return mod.exportToSvg({
    elements: restored.elements,
    appState: restored.appState,
    files: restored.files,
    exportPadding: 16,
  });
}
