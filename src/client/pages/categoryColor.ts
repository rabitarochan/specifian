/**
 * Default category color palette + a stable hash-based fallback.
 * User-set colors (from a category index `_.mdx` front-matter) take precedence;
 * see useCategoryStyles. This module provides the fallback when none is set.
 */

export const PALETTE = [
  '#4f46e5', // indigo (accent)
  '#0891b2', // cyan
  '#16a34a', // green
  '#ca8a04', // amber
  '#dc2626', // red
  '#9333ea', // purple
  '#db2777', // pink
  '#0d9488', // teal
  '#ea580c', // orange
  '#2563eb', // blue
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic fallback color derived from the category name. */
export function hashCategoryColor(category: string): string {
  return PALETTE[hash(category) % PALETTE.length];
}
