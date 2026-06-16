/**
 * Sample component that displays a status as a colored pill badge.
 *
 * Files placed in specs/_components/ are available in all MDX files without an explicit import.
 * The file name (PascalCase) or named export name becomes the component name.
 *
 * Note: Files inside _components can only import from 'react'.
 *       CSS imports are also not allowed — use inline styles (the style attribute) instead.
 */
import * as React from 'react';

interface StatusBadgeProps {
  status: string;
}

const COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#e5e7eb', fg: '#374151' }, // gray
  published: { bg: '#dcfce7', fg: '#166534' }, // green
  deprecated: { bg: '#fee2e2', fg: '#991b1b' }, // red
};

const DEFAULT_COLOR = { bg: '#dbeafe', fg: '#1e40af' }; // blue

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = COLORS[status] ?? DEFAULT_COLOR;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.5,
        backgroundColor: color.bg,
        color: color.fg,
      }}
    >
      {status}
    </span>
  );
}
