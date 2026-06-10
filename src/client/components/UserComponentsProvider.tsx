/**
 * ユーザー定義コンポーネント (specs/_components/) をアプリ起動時に 1 度ロードし、
 * 全 MDX 描画へ供給する共有プロバイダー。
 * ws の FsEvent で path が "_components/" 始まりのものが来たら、
 * コンパイルキャッシュを破棄して再ロードする → 再描画でユーザーコンポーネントが更新される。
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
  /** 初回ロード (成否問わず) が完了したか。MDX 描画はこれを待つ */
  ready: boolean;
  /** 再ロードのたびに増える。ErrorBoundary のリセットキーに使う */
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
      // 取得失敗時は前回値を保持 (アプリは落とさない)
    } finally {
      setReady(true);
      setVersion((v) => v + 1);
    }
  }, []);

  // 初回ロード
  useEffect(() => {
    void reload();
  }, [reload]);

  // _components/ 配下の変更でキャッシュ破棄 → 再ロード
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
