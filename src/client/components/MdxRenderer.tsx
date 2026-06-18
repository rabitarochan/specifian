/**
 * Receives raw MDX content, compiles it, supplies context, then renders it.
 * - Compile error: ErrorPanel
 * - Render (runtime) error: ErrorBoundary → ErrorPanel
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
  /** Handle wiki link clicks instead of normal navigation (for preview panes). */
  onWikiNavigate?: (id: string) => void;
}

export function MdxRenderer({ content, specs, category, slug, onWikiNavigate }: Props) {
  const { Content, error, loading } = useMdx(content, { specs, category, slug });
  const {
    components: userComponents,
    errors: userErrors,
    ready: userReady,
    version: userVersion,
  } = useUserComponents();

  // Merge user-defined components on top of built-ins (user wins on name conflict).
  const components = useMemo(
    () => ({ ...mdxComponents, ...userComponents }),
    [userComponents],
  );

  if (error) {
    return <ErrorPanel title="Compile Error" error={error} />;
  }
  // Wait for the initial user-component load to complete before rendering.
  // Without this, MDX that references an unloaded component would throw
  // during render, permanently locking the ErrorBoundary in an error state.
  if ((loading && !Content) || !userReady) {
    return <div className="p-10 text-muted-foreground">Compiling…</div>;
  }
  if (!Content) return null;

  return (
    <MdxProvider value={{ specs, category, onWikiNavigate }}>
      {userErrors.length > 0 && (
        <div
          className="my-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3.5"
          role="alert"
        >
          <div className="mb-1 font-bold text-destructive">
            User component compile error
          </div>
          <ul className="m-0 list-disc pl-[1.3em] text-[13px] text-[#991b1b]">
            {userErrors.map((e) => (
              <li key={e.path}>
                <code className="font-mono">{e.path}</code>: {e.message}
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
