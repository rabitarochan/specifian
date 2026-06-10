/**
 * wiki リンク remark プラグイン。
 * text ノードを走査し `[[target]]` / `[[target|label]]` を mdast `link` ノードへ置換する。
 * url は `#wiki:<target>` とし、描画側 (`a` レンダラー) が router Link に変換する。
 *
 * `code` / `inlineCode` は text ノードではないため visit('text') は触れない。
 */
import { visit } from 'unist-util-visit';
import type { Root, Text, Link, PhrasingContent, Parent } from 'mdast';

// 注意: WIKILINK_PATTERN は global フラグつきなので、毎回新しい RegExp を生成する。
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
      // 置換したノード群はスキップ (再走査不要)
      return index + replacement.length;
    });
  };
}
