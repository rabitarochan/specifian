/**
 * MDX 描画に渡す components マップ。
 * - 組み込みコンポーネント (TableDefinition / SpecList / DataView / SpecLink)
 * - `a` レンダラー: `#wiki:<target>` を検出して SpecLink (router Link) に変換する
 */
import {
  isValidElement,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { TableDefinition } from './TableDefinition';
import { SpecList } from './SpecList';
import { DataView } from './DataView';
import { SpecLink } from './SpecLink';
import { MermaidDiagram } from './MermaidDiagram';
import { Drawing } from './Drawing';

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

/** code 要素の className ("language-mermaid" 等) と本文テキストを取り出す */
function readCodeChild(
  child: ReactNode,
): { lang: string | null; text: string } | null {
  if (!isValidElement(child)) return null;
  const props = child.props as { className?: string; children?: ReactNode };
  const match = /language-(\w+)/.exec(props.className ?? '');
  const lang = match ? match[1] : null;
  const text = typeof props.children === 'string' ? props.children : '';
  return { lang, text };
}

/**
 * pre レンダラー: ```mermaid フェンスを図に変換する。
 * それ以外のコードブロックは通常の <pre> として描画する。
 */
function Pre({ children, ...rest }: HTMLAttributes<HTMLPreElement>) {
  const info = readCodeChild(children);
  if (info && info.lang === 'mermaid') {
    return <MermaidDiagram code={info.text.replace(/\n$/, '')} />;
  }
  return <pre {...rest}>{children}</pre>;
}

export const mdxComponents = {
  a: Anchor,
  pre: Pre,
  TableDefinition,
  SpecList,
  DataView,
  SpecLink,
  Drawing,
};
