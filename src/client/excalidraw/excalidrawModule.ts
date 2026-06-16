/**
 * Module loader that lazily loads @excalidraw/excalidraw.
 * Like mermaid, it is split from the main bundle via dynamic import
 * and loaded only when a Drawing / editor is actually rendered.
 *
 * v0.18.1 does not self-inject styles, so `@excalidraw/excalidraw/index.css`
 * must be imported explicitly (loaded inside the dynamic import in this file).
 */
type ExcalidrawModule = typeof import('@excalidraw/excalidraw');

let modulePromise: Promise<ExcalidrawModule> | null = null;

/** Loads the Excalidraw library (and its CSS) once and caches the result. */
export function loadExcalidraw(): Promise<ExcalidrawModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      // Load CSS first (v0.18 does not self-inject it)
      await import('@excalidraw/excalidraw/index.css');
      return import('@excalidraw/excalidraw');
    })();
  }
  return modulePromise;
}

/** Minimal scene shape accepted by restore(). */
export interface RawScene {
  elements?: unknown;
  appState?: unknown;
  files?: unknown;
}

/**
 * Normalizes a fetched (possibly hand-written) scene via Excalidraw's restore().
 * Makes partial / hand-written scene files safe to render and edit.
 *
 * Known caveat: when passed as initialData, appState.collaborators must be a Map,
 * but restore() returns a normalized appState without collaborators, so passing it
 * directly to initialData is safe (no Map conversion needed).
 */
export async function restoreScene(scene: unknown) {
  const { restore } = await loadExcalidraw();
  const raw = (scene ?? {}) as RawScene;
  // restore takes elements/appState/files and fills in missing or invalid values
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
 * Renders a scene as a static SVG. Used in view mode without launching the editor.
 * Input is normalized via restore() before being passed to exportToSvg.
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
