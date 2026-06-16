/**
 * Shared provider that loads user-defined components (.specs/_components/) once on app start
 * and supplies them to all MDX renders.
 * When an FsEvent with a path starting with "_components/" arrives via WebSocket,
 * the compile cache is invalidated and components are reloaded → re-renders pick up the changes.
 */
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  loadUserComponents,
  invalidateUserComponents,
  type UserComponentsResult,
} from '../mdx/userComponents';
import { useSpecs } from './SpecsProvider';

interface UserComponentsContextValue {
  components: Record<string, ComponentType<unknown>>;
  errors: { path: string; message: string }[];
  /** Whether the initial load (success or failure) has completed. MDX rendering waits for this. */
  ready: boolean;
  /** Increments on every reload. Used as the ErrorBoundary reset key. */
  version: number;
}

const UserComponentsContext = createContext<UserComponentsContextValue>({
  components: {},
  errors: [],
  ready: false,
  version: 0,
});

export function useUserComponents(): UserComponentsContextValue {
  return useContext(UserComponentsContext);
}

export function UserComponentsProvider({ children }: { children: ReactNode }) {
  const { onFsEvent } = useSpecs();
  const [result, setResult] = useState<UserComponentsResult>({
    components: {},
    errors: [],
  });
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    try {
      const next = await loadUserComponents();
      setResult(next);
    } catch {
      // On fetch failure, keep the previous value (don't crash the app)
    } finally {
      setReady(true);
      setVersion((v) => v + 1);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void reload();
  }, [reload]);

  // Changes under _components/ → invalidate cache and reload
  useEffect(() => {
    const unsub = onFsEvent((e) => {
      if (e.path.startsWith('_components/')) {
        invalidateUserComponents();
        void reload();
      }
    });
    return unsub;
  }, [onFsEvent, reload]);

  return (
    <UserComponentsContext.Provider
      value={{ ...result, ready, version }}
    >
      {children}
    </UserComponentsContext.Provider>
  );
}
