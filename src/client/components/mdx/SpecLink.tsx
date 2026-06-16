/**
 * Component version of a wiki link.
 * `to` is a spec ID ("tables:users").
 * Applies broken-link style if the target spec doesn't exist in specs (navigation still works).
 */
import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { specRoute } from '@shared/types';
import { useMdxContext } from '../../mdx/MdxContext';

export function SpecLink({ to, children }: { to: string; children?: ReactNode }) {
  const { specs, onWikiNavigate } = useMdxContext();
  const exists = specs.some((s) => s.id === to);
  const label = children ?? to;

  // In contexts where onWikiNavigate is set (e.g. graph preview), suppress normal navigation and delegate.
  // Modified clicks / middle-click respect the browser default (new tab, etc.).
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onWikiNavigate) return;
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onWikiNavigate(to);
  };

  return (
    <Link
      to={specRoute(to)}
      onClick={handleClick}
      className={exists ? 'sb-wikilink' : 'sb-wikilink sb-wikilink--broken'}
      title={exists ? undefined : `Unresolved link: ${to}`}
    >
      {label}
    </Link>
  );
}
