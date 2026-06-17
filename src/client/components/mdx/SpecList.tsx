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
    return <p className="text-muted-foreground">No specs in this category yet.</p>;
  }

  return (
    <div className="my-4 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {items.map((s) => (
        <Link
          key={s.id}
          to={specRoute(s.id)}
          className="flex flex-col gap-1 rounded-lg border border-border bg-background p-[14px_16px] transition-[border-color,box-shadow] duration-[0.12s] hover:border-primary hover:shadow-[0_2px_10px_rgba(79,70,229,0.08)] hover:no-underline"
        >
          <span className="font-semibold text-foreground">{s.title}</span>
          {s.description && (
            <span className="text-[13px] text-muted-foreground">{s.description}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
