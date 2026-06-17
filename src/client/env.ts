/**
 * Runtime environment flags for the client.
 *
 * The SAME prebuilt bundle powers both modes:
 * - `specifian serve` serves it dynamically (talks to the Express API + WebSocket).
 * - `specifian export` writes a static snapshot whose index.html injects
 *   `window.__SPECIFIAN_STATIC__ = true` before the module bundle runs.
 *
 * In static mode the client reads pre-generated JSON under `data/` (relative to the
 * document, so it works at any subpath), disables all writes/WebSocket, and hides
 * the editing UI (read-only).
 */
declare global {
  interface Window {
    __SPECIFIAN_STATIC__?: boolean;
  }
}

/** True when running as a static snapshot (no server). */
export const STATIC: boolean =
  typeof window !== 'undefined' && window.__SPECIFIAN_STATIC__ === true;

/** True when the editing UI (create/edit/delete/rename/save) must be hidden. */
export const READONLY: boolean = STATIC;

/**
 * Build a URL for a pre-generated data file in static mode.
 * Relative to the document base so the snapshot works under any subpath
 * (HashRouter keeps the document URL stable, so this always resolves to the
 * deployment root regardless of the active route).
 */
export function dataUrl(relPath: string): string {
  return `data/${relPath}`;
}
