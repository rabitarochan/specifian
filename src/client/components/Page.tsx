/**
 * Shared page-chrome primitives used across the route pages. Centralizing the
 * container / page-bar / title / loading markup keeps the Tailwind classes
 * consistent and makes the eventual removal of the legacy `index.css` rules a
 * single-place change.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/utils';

/** Centered reading column (or a full-width `preview` variant for the editor pane). */
export function PageContainer({
  preview = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { preview?: boolean }) {
  return (
    <article
      className={cn(
        preview
          ? 'px-7 pb-[60px] pt-6'
          : 'mx-auto max-w-[820px] px-10 pb-20 pt-8',
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

/** Sticky-feel header row aligned to the reading column. */
export function PageBar({
  tight = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { tight?: boolean }) {
  return (
    <header
      className={cn(
        'mx-auto flex max-w-[820px] items-center justify-between gap-4 border-b border-border px-10 pt-5',
        tight ? 'pb-3.5' : 'pb-0',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}

export function PageTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={cn('m-0 min-w-0 truncate text-xl font-bold', className)} {...props}>
      {children}
    </h1>
  );
}

export function IdBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
      {children}
    </span>
  );
}

export function Loading() {
  return <div className="p-10 text-muted-foreground">Loading…</div>;
}
