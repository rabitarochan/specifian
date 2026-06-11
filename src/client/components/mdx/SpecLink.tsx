/**
 * wiki リンクのコンポーネント版。
 * to は スペック ID ("tables:users")。
 * リンク先が specs に存在しなければ broken-link スタイルを適用する (遷移は可能)。
 */
import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { specRoute } from '@shared/types';
import { useMdxContext } from '../../mdx/MdxContext';

export function SpecLink({ to, children }: { to: string; children?: ReactNode }) {
  const { specs, onWikiNavigate } = useMdxContext();
  const exists = specs.some((s) => s.id === to);
  const label = children ?? to;

  // onWikiNavigate がある文脈 (グラフプレビューなど) では通常遷移を抑制して委譲する。
  // 修飾キー付き / 中クリックはブラウザー既定 (新規タブ等) を尊重する。
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
      title={exists ? undefined : `未解決のリンク: ${to}`}
    >
      {label}
    </Link>
  );
}
