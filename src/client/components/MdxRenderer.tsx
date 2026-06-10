/**
 * content (生 MDX) を受け取り、コンパイル → コンテキスト供給 → 描画する。
 * - コンパイルエラー: ErrorPanel
 * - 描画 (ランタイム) エラー: ErrorBoundary → ErrorPanel
 */
import type { SpecMeta } from '@shared/types';
import { useMdx } from '../mdx/useMdx';
import { MdxProvider } from '../mdx/MdxContext';
import { mdxComponents } from './mdx/mdxComponents';
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

  if (error) {
    return <ErrorPanel title="コンパイルエラー" error={error} />;
  }
  if (loading && !Content) {
    return <div className="sb-loading">コンパイル中…</div>;
  }
  if (!Content) return null;

  return (
    <MdxProvider value={{ specs, category }}>
      <ErrorBoundary resetKey={content}>
        <div className="sb-prose">
          <Content components={mdxComponents} />
        </div>
      </ErrorBoundary>
    </MdxProvider>
  );
}
