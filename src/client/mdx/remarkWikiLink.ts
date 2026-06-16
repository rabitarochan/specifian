/**
 * Remark plugin for wiki links.
 * Traverses text nodes and replaces `[[target]]` / `[[target|label]]` with mdast `link` nodes.
 * The url is `#wiki:<target>`; the rendering side (`a` renderer) converts it to a router Link.
 *
 * `code` / `inlineCode` are not text nodes, so visit('text') does not touch them.
 */
import { visit } from 'unist-util-visit';
import type { Root, Text, Link, PhrasingContent, Parent } from 'mdast';

// Note: WIKILINK_PATTERN uses the global flag, so a new RegExp must be created each time.
const SOURCE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/.source;

export function remarkWikiLink() {
  return (tree: Root): void => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;
      const value = node.value;
      if (!value.includes('[[')) return;

      const re = new RegExp(SOURCE, 'g');
      const replacement: PhrasingContent[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      let matched = false;

      while ((m = re.exec(value)) !== null) {
        matched = true;
        const [full, target, label] = m;
        const start = m.index;
        if (start > last) {
          replacement.push({ type: 'text', value: value.slice(last, start) });
        }
        const link: Link = {
          type: 'link',
          url: `#wiki:${target}`,
          children: [{ type: 'text', value: label ?? target }],
        };
        replacement.push(link);
        last = start + full.length;
      }

      if (!matched) return;
      if (last < value.length) {
        replacement.push({ type: 'text', value: value.slice(last) });
      }

      parent.children.splice(index, 1, ...replacement);
      // Skip the replaced nodes (no need to re-traverse)
      return index + replacement.length;
    });
  };
}
