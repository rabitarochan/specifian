/**
 * Displays a list of specs in a category as link cards.
 * specs / default category are taken from MdxContext rather than MDX scope.
 * The index (_) and template (_template) specs are excluded.
 */
import { Link } from 'react-router-dom';
import { specRoute } from '@shared/types';
import { useMdxContext } from '../../mdx/MdxContext';

export function SpecList({ category }: { category?: string }) {
  const ctx = useMdxContext();
  const target = category ?? ctx.category;

  const items = ctx.specs.filter(
    (s) => s.category === target && !s.isIndex && s.slug !== '_template',
  );

  if (items.length === 0) {
    return <p className="sb-empty">No specs in this category yet.</p>;
  }

  return (
    <div className="sb-card-grid">
      {items.map((s) => (
        <Link key={s.id} to={specRoute(s.id)} className="sb-card">
          <span className="sb-card__title">{s.title}</span>
          {s.description && <span className="sb-card__desc">{s.description}</span>}
        </Link>
      ))}
    </div>
  );
}
