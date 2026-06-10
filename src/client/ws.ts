/**
 * 再接続機能つき WebSocket クライアント。
 * `/ws` を購読し、fs イベントをリスナーへ配信する。
 * Vite dev は /ws を ws://localhost:4399 へ proxy する。
 */
import type { FsEvent } from '@shared/types';

type Listener = (event: FsEvent) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const MAX_DELAY = 15000;

function url(): string {
  return `ws://${location.host}/ws`;
}

function connect(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    socket = new WebSocket(url());
  } catch {
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    reconnectDelay = 1000;
  });

  socket.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data as string) as FsEvent;
      if (data && data.type === 'fs') {
        for (const l of listeners) l(data);
      }
    } catch {
      // 不正な JSON は無視
    }
  });

  socket.addEventListener('close', () => {
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener('error', () => {
    // close が続けて発火するため、ここでは閉じるだけ
    socket?.close();
  });
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  }, reconnectDelay);
}

/**
 * fs イベントを購読する。最初の購読時に接続を開始する。
 * 返り値の関数で購読解除する。
 */
export function subscribeFsEvents(listener: Listener): () => void {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
  };
}
