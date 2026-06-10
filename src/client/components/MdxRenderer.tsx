/**
 * content (生 MDX) を受け取り、コンパイル → コンテキスト供給 → 描画する。
 * - コンパイルエラー: ErrorPanel
 * - 描画 (ランタイム) エラー: ErrorBoundary → ErrorPanel
 */
import { useMemo } from 'react';
import type { SpecMeta } from '@shared/types';
import { useMdx } from '../mdx/useMdx';
import { MdxProvider } from '../mdx/MdxContext';
import { mdxComponents } from './mdx/mdxComponents';
import { useUserComponents } from './UserComponentsProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorPanel } from './ErrorPanel';

interface Props {
  content: string;
  specs: SpecMeta[];
  category: string;
  slug: string;
}

export function MdxRenderer({ content, specs, category, slug }: Props) {
  const { Content, error, loading } = useMdx(content, { specs, category, slug });
  const {
    components: userComponents,
    errors: userErrors,
    ready: userReady,
    version: userVersion,
  } = useUserComponents();

  // ユーザー定義コンポーネントを組み込みへ重ね合わせる (名前衝突時はユーザー優先)。
  const components = useMemo(
    () => ({ ...mdxComponents, ...userComponents }),
    [userComponents],
  );

  if (error) {
    return <ErrorPanel title="コンパイルエラー" error={error} />;
  }
  // ユーザーコンポーネントの初回ロード完了を待ってから描画する。
  // 待たずに描画すると、未ロードのコンポーネントを参照する MDX が
  // 描画時に throw し、ErrorBoundary がエラー状態のまま固定されてしまう。
  if ((loading && !Content) || !userReady) {
    return <div className="sb-loading">コンパイル中…</div>;
  }
  if (!Content) return null;

  return (
    <MdxProvider value={{ specs, category }}>
      {userErrors.length > 0 && (
        <div className="sb-error-panel" role="alert">
          <div className="sb-error-panel__title">
            ユーザーコンポーネントのコンパイルエラー
          </div>
          <ul className="sb-error-panel__list">
            {userErrors.map((e) => (
              <li key={e.path}>
                <code>{e.path}</code>: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ErrorBoundary resetKey={`${content}#${userVersion}`}>
        <div className="sb-prose">
          <Content components={components} />
        </div>
      </ErrorBoundary>
    </MdxProvider>
  );
}
