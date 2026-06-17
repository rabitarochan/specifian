/**
 * Home. Renders the root `_.mdx` (`GET /api/specs/_`) if it exists.
 * Falls back to a welcome screen + category list on 404.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SpecDetail } from '@shared/types';
import { fetchSpec, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { MdxRenderer } from '../components/MdxRenderer';
import { GuidePanel } from '../components/GuidePanel';
import { PageContainer, Loading } from '../components/Page';
import { Card, CardTitle } from '../components/ui/card';

export function Home() {
  const { specs } = useSpecs();
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Root-level _.mdx (category="", slug="_")
    fetchSpec('', '_')
      .then((d) => {
        if (!active) return;
        setDetail(d);
        setNotFound(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiHttpError && err.status === 404) {
          setNotFound(true);
          setDetail(null);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Loading />;

  if (detail && !notFound) {
    return (
      <PageContainer>
        <GuidePanel category="" />
        <MdxRenderer
          content={detail.content}
          specs={specs}
          category={detail.meta.category}
          slug={detail.meta.slug}
        />
      </PageContainer>
    );
  }

  // Welcome screen + category list
  const categories = [...new Set(specs.map((s) => s.category))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <PageContainer>
      <GuidePanel category="" />
      <div className="sb-prose">
        <h1>Welcome to specifian</h1>
        <p>
          Browse and edit MDX specs under <code>.specs/</code>.
          Choose a category or spec from the sidebar on the left.
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
            No specs yet. Use the "＋" button in the sidebar to create your first category.
          </p>
        )}
      </div>
    </PageContainer>
  );
}
