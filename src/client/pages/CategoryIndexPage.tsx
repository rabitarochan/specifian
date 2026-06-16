/**
 * Category index page.
 * Renders `<category>/_.mdx` if it exists, otherwise shows an auto-generated SpecList.
 * The header button lets you edit the index (or create then edit if none exists).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpecDetail } from '@shared/types';
import { fetchSpec, createSpec, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { useToast } from '../components/Toast';
import { MdxRenderer } from '../components/MdxRenderer';
import { GuidePanel } from '../components/GuidePanel';
import { MdxProvider } from '../mdx/MdxContext';
import { SpecList } from '../components/mdx/SpecList';

export function CategoryIndexPage({ category }: { category: string }) {
  const { specs, refetch } = useSpecs();
  const navigate = useNavigate();
  const { show } = useToast();
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  /** Route for /specs/<category>/_ ("" category = root index) */
  const indexRoute = category ? `/specs/${category}/_` : '/specs/_';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetail(null);
    fetchSpec(category, '_')
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((err: unknown) => {
        // 404 is fine (falls back to auto list). Other errors also fall back to list view.
        if (!(err instanceof ApiHttpError)) {
          // Network error etc. — log only
          console.error(err);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category]);

  /** For categories without _.mdx: create a default index and navigate to edit it. */
  const createAndEdit = async () => {
    setCreating(true);
    try {
      await createSpec({ category, slug: '_', title: category || 'Home' });
      await refetch();
      navigate(`${indexRoute}?edit=1`);
    } catch (err) {
      show(
        err instanceof Error
          ? `Failed to create index: ${err.message}`
          : 'Failed to create index',
      );
      setCreating(false);
    }
  };

  if (loading) return <div className="sb-loading">Loading…</div>;

  if (detail) {
    return (
      <article className="sb-content">
        <header className="sb-page-bar">
          <h1 className="sb-page-bar__title">{detail.meta.title}</h1>
          <div className="sb-page-bar__actions">
            <button
              className="sb-btn"
              onClick={() => navigate(`${indexRoute}?edit=1`)}
            >
              Edit Index
            </button>
          </div>
        </header>
        <GuidePanel category={category} />
        <MdxRenderer
          content={detail.content}
          specs={specs}
          category={category}
          slug="_"
        />
      </article>
    );
  }

  // Auto-generated spec list
  return (
    <article className="sb-content">
      <header className="sb-page-bar">
        <h1 className="sb-page-bar__title">{category}</h1>
        <div className="sb-page-bar__actions">
          <button className="sb-btn" onClick={createAndEdit} disabled={creating}>
            {creating ? 'Creating…' : 'Create Index'}
          </button>
        </div>
      </header>
      <GuidePanel category={category} />
      <div className="sb-prose">
        <MdxProvider value={{ specs, category }}>
          <SpecList category={category} />
        </MdxProvider>
      </div>
    </article>
  );
}
