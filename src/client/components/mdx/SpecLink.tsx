/**
 * wiki リンクのコンポーネント版。
 * to は スペック ID ("tables:users")。
 * リンク先が specs に存在しなければ broken-link スタイルを適用する (遷移は可能)。
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { specRoute } from '@shared/types';
import { useMdxContext } from '../../mdx/MdxContext';

export function SpecLink({ to, children }: { to: string; children?: ReactNode }) {
  const { specs } = useMdxContext();
  const exists = specs.some((s) => s.id === to);
  const label = children ?? to;
  return (
    <Link
      to={specRoute(to)}
      className={exists ? 'sb-wikilink' : 'sb-wikilink sb-wikilink--broken'}
      title={exists ? undefined : `未解決のリンク: ${to}`}
    >
      {label}
    </Link>
  );
}
