/**
 * MDX 描画に渡す components マップ。
 * - 組み込みコンポーネント (TableDefinition / SpecList / DataView / SpecLink)
 * - `a` レンダラー: `#wiki:<target>` を検出して SpecLink (router Link) に変換する
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { TableDefinition } from './TableDefinition';
import { SpecList } from './SpecList';
import { DataView } from './DataView';
import { SpecLink } from './SpecLink';

const WIKI_PREFIX = '#wiki:';

function Anchor({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
  if (href && href.startsWith(WIKI_PREFIX)) {
    const target = href.slice(WIKI_PREFIX.length);
    return <SpecLink to={target}>{children}</SpecLink>;
  }
  // 外部リンクは新規タブで開く (相対 / アンカーはそのまま)
  const external = !!href && /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      {...rest}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      {children}
    </a>
  );
}

export const mdxComponents = {
  a: Anchor,
  TableDefinition,
  SpecList,
  DataView,
  SpecLink,
};
