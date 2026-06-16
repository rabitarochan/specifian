/**
 * WebSocket client with auto-reconnect.
 * Subscribes to `/ws` and dispatches fs events to listeners.
 * Vite dev proxies /ws to ws://localhost:4399.
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
      // Ignore malformed JSON
    }
  });

  socket.addEventListener('close', () => {
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener('error', () => {
    // 'close' fires right after 'error', so just close here
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
 * Subscribe to fs events. Opens the connection on the first subscription.
 * Returns a function that removes the subscription.
 */
export function subscribeFsEvents(listener: Listener): () => void {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
  };
}
