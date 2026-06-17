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
import { PageContainer, PageBar, PageTitle, Loading } from '../components/Page';
import { Button } from '../components/ui/button';
import { READONLY } from '../env';

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

  if (loading) return <Loading />;

  if (detail) {
    return (
      <>
        <PageBar>
          <PageTitle>{detail.meta.title}</PageTitle>
          {!READONLY && (
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`${indexRoute}?edit=1`)}
              >
                Edit Index
              </Button>
            </div>
          )}
        </PageBar>
        <PageContainer>
          <GuidePanel category={category} />
          <MdxRenderer
            content={detail.content}
            specs={specs}
            category={category}
            slug="_"
          />
        </PageContainer>
      </>
    );
  }

  // Auto-generated spec list
  return (
    <>
      <PageBar>
        <PageTitle>{category}</PageTitle>
        {!READONLY && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={createAndEdit} disabled={creating}>
              {creating ? 'Creating…' : 'Create Index'}
            </Button>
          </div>
        )}
      </PageBar>
      <PageContainer>
        <GuidePanel category={category} />
        <div className="sb-prose">
          <MdxProvider value={{ specs, category }}>
            <SpecList category={category} />
          </MdxProvider>
        </div>
      </PageContainer>
    </>
  );
}
