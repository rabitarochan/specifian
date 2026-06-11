/// <reference types="vite/client" />

// Excalidraw の CSS エントリーは exports に types を持たないため、
// 副作用 import 用に空モジュールとして宣言する (Vite が実体を処理する)。
declare module '@excalidraw/excalidraw/index.css';
