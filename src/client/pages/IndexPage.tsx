/**
 * Index page for a category ("" = root / Home).
 *
 * Renders `<category>/_.mdx` if it exists. Otherwise falls back to:
 * - root ("")     → a welcome screen listing the project's categories,
 * - a sub-category → an auto-generated SpecList of that category's specs.
 *
 * The header (Title · Guide · Edit/Create) matches the spec page. Editing the
 * index navigates to the spec editor at `<indexRoute>?edit=1`.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Edit } from 'lucide-react';
import type { SpecDetail } from '@shared/types';
import { fetchSpec, createSpec, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { useToast } from '../components/Toast';
import { MdxRenderer } from '../components/MdxRenderer';
import { useRegisterGuideCategory } from '../components/GuideProvider';
import { GuideToggleButton } from '../components/GuideDrawer';
import { MdxProvider } from '../mdx/MdxContext';
import { SpecList } from '../components/mdx/SpecList';
import { PageContainer, PageBar, PageTitle, Loading } from '../components/Page';
import { Button } from '../components/ui/button';
import { Card, CardTitle } from '../components/ui/card';
import { READONLY } from '../env';

export function IndexPage({ category }: { category: string }) {
  const { specs, refetch } = useSpecs();
  useRegisterGuideCategory(category);
  const navigate = useNavigate();
  const { show } = useToast();
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const isRoot = category === '';
  /** Route for /specs/<category>/_ ("" category = root index). */
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
        // 404 is fine (falls back to welcome/auto list). Other errors also fall back.
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

  /** When no _.mdx exists yet: create a default index and open it for editing. */
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

  return (
    <>
      <PageBar tight>
        <PageTitle>{detail?.meta.title ?? (category || 'Home')}</PageTitle>
        <div className="flex shrink-0 gap-2">
          <GuideToggleButton />
          {!READONLY &&
            (detail ? (
              <Button
                variant="outline"
                onClick={() => navigate(`${indexRoute}?edit=1`)}
              >
                <Edit />
                Edit
              </Button>
            ) : (
              <Button variant="outline" onClick={createAndEdit} disabled={creating}>
                {creating ? 'Creating…' : 'Create Index'}
              </Button>
            ))}
        </div>
      </PageBar>

      <PageContainer>
        {detail ? (
          <MdxRenderer
            content={detail.content}
            specs={specs}
            category={category}
            slug="_"
          />
        ) : isRoot ? (
          <WelcomeScreen />
        ) : (
          <div className="sb-prose">
            <MdxProvider value={{ specs, category }}>
              <SpecList category={category} />
            </MdxProvider>
          </div>
        )}
      </PageContainer>
    </>
  );
}

/** Root fallback when no `_.mdx` exists: welcome blurb + a grid of category links. */
function WelcomeScreen() {
  const { specs } = useSpecs();
  const categories = [...new Set(specs.map((s) => s.category))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <div className="sb-prose">
      <h1>Welcome to Specifian</h1>
      <p>
        Browse and edit MDX specs under <code>.specs/</code>. Choose a category or
        spec from the sidebar on the left.
      </p>
      {categories.length > 0 ? (
        <>
          <h2>Categories</h2>
          <div className="my-4 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {categories.map((cat) => (
              <Link
                key={cat}
                to={`/specs/${cat}`}
                className="group transition-colors hover:no-underline"
              >
                <Card className="px-4 py-3.5 transition-shadow group-hover:border-primary group-hover:shadow-[0_2px_10px_rgba(79,70,229,0.08)]">
                  <CardTitle>{cat}</CardTitle>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p>
          No specs yet. Use the "＋" button in the sidebar to create your first
          category.
        </p>
      )}
    </div>
  );
}
