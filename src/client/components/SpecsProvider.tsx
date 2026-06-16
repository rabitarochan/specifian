/**
 * Shared store that holds all SpecMeta and re-fetches on WebSocket fs events.
 * The sidebar and individual pages reference specs / refetch from here.
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
  /** Register a fs event listener (so pages can detect changes to the current spec). */
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
      // On fetch failure, keep the previous value
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const unsub = subscribeFsEvents((e) => {
      // Re-fetch the tree on any fs event
      void refetch();
      // Also dispatch to page-level listeners
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
