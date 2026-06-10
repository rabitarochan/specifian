/**
 * 全 SpecMeta を保持し、WebSocket の fs イベントで再取得する共有ストア。
 * サイドバーや各ページが specs / refetch を参照する。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SpecMeta, FsEvent } from '@shared/types';
import { fetchSpecs } from '../api';
import { subscribeFsEvents } from '../ws';

interface SpecsContextValue {
  specs: SpecMeta[];
  loading: boolean;
  refetch: () => Promise<void>;
  /** 現在の fs イベントリスナー登録 (ページが現在のスペック変更を検知するため) */
  onFsEvent: (listener: (e: FsEvent) => void) => () => void;
}

const SpecsContext = createContext<SpecsContextValue | null>(null);

export function useSpecs(): SpecsContextValue {
  const ctx = useContext(SpecsContext);
  if (!ctx) throw new Error('useSpecs must be used within SpecsProvider');
  return ctx;
}

export function SpecsProvider({ children }: { children: ReactNode }) {
  const [specs, setSpecs] = useState<SpecMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const listeners = useRef(new Set<(e: FsEvent) => void>());

  const refetch = useCallback(async () => {
    try {
      const next = await fetchSpecs();
      setSpecs(next);
    } catch {
      // 取得失敗時は前回値を保持
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const unsub = subscribeFsEvents((e) => {
      // どの fs イベントでもツリーを再取得する
      void refetch();
      // ページ側リスナーへも配信
      for (const l of listeners.current) l(e);
    });
    return unsub;
  }, [refetch]);

  const onFsEvent = useCallback((listener: (e: FsEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return (
    <SpecsContext.Provider value={{ specs, loading, refetch, onFsEvent }}>
      {children}
    </SpecsContext.Provider>
  );
}
