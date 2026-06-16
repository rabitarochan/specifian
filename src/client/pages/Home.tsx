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

  if (loading) return <div className="sb-loading">Loading…</div>;

  if (detail && !notFound) {
    return (
      <article className="sb-content">
        <MdxRenderer
          content={detail.content}
          specs={specs}
          category={detail.meta.category}
          slug={detail.meta.slug}
        />
      </article>
    );
  }

  // Welcome screen + category list
  const categories = [...new Set(specs.map((s) => s.category))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <article className="sb-content">
      <div className="sb-prose">
        <h1>Welcome to specifian</h1>
        <p>
          Browse and edit MDX specs under <code>specs/</code>.
          Choose a category or spec from the sidebar on the left.
        </p>
        {categories.length > 0 ? (
          <>
            <h2>Categories</h2>
            <div className="sb-card-grid">
              {categories.map((cat) => (
                <Link key={cat} to={`/specs/${cat}`} className="sb-card">
                  <span className="sb-card__title">{cat}</span>
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
    </article>
  );
}
