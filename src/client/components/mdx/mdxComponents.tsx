/**
 * Components map passed to MDX rendering.
 * - Built-in components (TableDefinition / SpecList / DataView / SpecLink)
 * - `a` renderer: detects `#wiki:<target>` and converts it to a SpecLink (router Link)
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
  // External links open in a new tab (relative / anchor links are left unchanged)
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

/** Extracts the className (e.g. "language-mermaid") and body text from a code element. */
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
 * pre renderer: converts ```mermaid fences to diagrams.
 * All other code blocks are rendered as normal <pre> elements.
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
