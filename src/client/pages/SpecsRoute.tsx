/**
 * Dispatcher for the `/specs/*` splat route.
 * Treats the last segment of the splat as a slug candidate:
 *  1. GET /api/specs/<splat> succeeds → SpecPage
 *  2. 404 → treat as category, CategoryIndexPage (<splat> = full category path)
 * Checks specs list for an ID match first to avoid unnecessary requests.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSpecByPath, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { Loading } from '../components/Page';
import { SpecPage } from './SpecPage';
import { CategoryIndexPage } from './CategoryIndexPage';

type Resolved =
  | { kind: 'spec'; category: string; slug: string; specId: string }
  | { kind: 'category'; category: string }
  | { kind: 'loading' };

/** splat "api/v1/users" -> { category: "api/v1", slug: "users" } */
function splitSplat(splat: string): { category: string; slug: string } {
  const idx = splat.lastIndexOf('/');
  if (idx < 0) return { category: '', slug: splat };
  return { category: splat.slice(0, idx), slug: splat.slice(idx + 1) };
}

export function SpecsRoute() {
  const params = useParams();
  const splat = (params['*'] ?? '').replace(/\/+$/, '');
  const { specs } = useSpecs();
  const [resolved, setResolved] = useState<Resolved>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    setResolved({ kind: 'loading' });

    if (!splat) {
      setResolved({ kind: 'category', category: '' });
      return;
    }

    const { category, slug } = splitSplat(splat);
    const candidateId = `${category}:${slug}`;

    // Immediately resolve as a spec if the ID matches the local cache
    if (specs.some((s) => s.id === candidateId)) {
      setResolved({ kind: 'spec', category, slug, specId: candidateId });
      return;
    }

    // Fetch to confirm (in case the specs cache is stale)
    fetchSpecByPath(splat)
      .then((d) => {
        if (!active) return;
        setResolved({
          kind: 'spec',
          category: d.meta.category,
          slug: d.meta.slug,
          specId: d.meta.id,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiHttpError && err.status === 404) {
          // Treat as a category
          setResolved({ kind: 'category', category: splat });
        } else {
          // Fall back to category view on other errors too
          setResolved({ kind: 'category', category: splat });
        }
      });

    return () => {
      active = false;
    };
  }, [splat, specs]);

  if (resolved.kind === 'loading') {
    return <Loading />;
  }
  if (resolved.kind === 'spec') {
    return (
      <SpecPage
        key={resolved.specId}
        category={resolved.category}
        slug={resolved.slug}
        specId={resolved.specId}
      />
    );
  }
  return <CategoryIndexPage key={resolved.category} category={resolved.category} />;
}
