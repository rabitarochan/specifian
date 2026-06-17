/**
 * Resolves per-category presentation metadata (icon + color).
 *
 * The metadata lives in each category's index `_.mdx` front-matter (`icon`, `color`),
 * which already flows to the client as the `data` of the `isIndex` SpecMeta via
 * GET /api/specs (SpecsProvider). So we derive a lookup from the existing specs —
 * no extra fetch or provider is needed. Updates arrive live because SpecsProvider
 * refetches on watcher fs events.
 */
import { useMemo } from 'react';
import { useSpecs } from '../components/SpecsProvider';
import { hashCategoryColor } from '../pages/categoryColor';

export interface CategoryStyle {
  icon?: string;
  color?: string;
}

export interface UseCategoryStyles {
  /** category -> { icon?, color? } from the index front-matter. */
  styles: Map<string, CategoryStyle>;
  /** User-set color when present, otherwise the deterministic hash fallback. */
  categoryColor: (category: string) => string;
  /** User-set lucide icon name, or undefined when none is set. */
  categoryIcon: (category: string) => string | undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function useCategoryStyles(): UseCategoryStyles {
  const { specs } = useSpecs();

  const styles = useMemo(() => {
    const map = new Map<string, CategoryStyle>();
    for (const s of specs) {
      if (!s.isIndex) continue;
      const icon = asString(s.data['icon']);
      const color = asString(s.data['color']);
      if (icon === undefined && color === undefined) continue;
      map.set(s.category, { icon, color });
    }
    return map;
  }, [specs]);

  return useMemo(
    () => ({
      styles,
      categoryColor: (category: string) =>
        styles.get(category)?.color ?? hashCategoryColor(category),
      categoryIcon: (category: string) => styles.get(category)?.icon,
    }),
    [styles],
  );
}
