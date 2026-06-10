/**
 * 左サイドバー: アプリ名 + ナビ (ホーム/グラフ) + カテゴリーツリー。
 * カテゴリーはネストパス (`api/v1`) を木構造に展開して表示する。
 * ヘッダーに「新しいカテゴリー」、各カテゴリーに「スペックを追加」ボタン。
 */
import { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { SpecMeta } from '@shared/types';
import { specRoute } from '@shared/types';
import type { ValidationIssue } from '@shared/types';
import { useSpecs } from './SpecsProvider';
import { useValidation } from './ValidationProvider';
import { useSearchPalette } from './SearchPalette';
import { NewCategoryDialog } from './NewCategoryDialog';
import { NewSpecDialog } from './NewSpecDialog';

interface TreeNode {
  /** このノードのフルパス ("api", "api/v1") */
  path: string;
  /** 表示名 (末尾セグメント) */
  name: string;
  children: Map<string, TreeNode>;
  /** このカテゴリーに直接属する非インデックス・非テンプレートのスペック */
  specs: SpecMeta[];
  /** このカテゴリーが実在する (specs を 1 つ以上含む or 子を持つ) */
}

function buildTree(specs: SpecMeta[]): TreeNode {
  const root: TreeNode = { path: '', name: '', children: new Map(), specs: [] };
  // すべてのカテゴリーを列挙 (空のカテゴリーも _ / _template のみで存在しうる)
  const categories = new Set<string>();
  for (const s of specs) categories.add(s.category);

  const ensure = (catPath: string): TreeNode => {
    const segments = catPath.split('/');
    let node = root;
    let acc = '';
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      let child = node.children.get(seg);
      if (!child) {
        child = { path: acc, name: seg, children: new Map(), specs: [] };
        node.children.set(seg, child);
      }
      node = child;
    }
    return node;
  };

  for (const cat of categories) ensure(cat);
  for (const s of specs) {
    if (s.isIndex || s.slug === '_template') continue;
    ensure(s.category).specs.push(s);
  }
  return root;
}

/** スペック行に付けるスキーマ違反バッジ */
function IssueBadge({ issues }: { issues: ValidationIssue[] }) {
  const title = `${issues.length} 件のスキーマ違反\n${issues
    .map((i) => `${i.path}: ${i.message}`)
    .join('\n')}`;
  return (
    <span className="sb-issue-badge" title={title} aria-label={title}>
      ⚠
    </span>
  );
}

function CategoryNode({
  node,
  onAddSpec,
  issuesBySpecId,
}: {
  node: TreeNode;
  onAddSpec: (category: string) => void;
  issuesBySpecId: Record<string, ValidationIssue[]>;
}) {
  const sortedChildren = useMemo(
    () => [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [node],
  );
  const sortedSpecs = useMemo(
    () => [...node.specs].sort((a, b) => a.title.localeCompare(b.title)),
    [node.specs],
  );

  return (
    <li className="sb-tree__item">
      <div className="sb-tree__row">
        <NavLink
          to={`/specs/${node.path}`}
          className={({ isActive }) =>
            isActive ? 'sb-tree__cat sb-tree__cat--active' : 'sb-tree__cat'
          }
        >
          {node.name}
        </NavLink>
        <button
          className="sb-icon-btn sb-tree__add"
          title="スペックを追加"
          onClick={() => onAddSpec(node.path)}
        >
          ＋
        </button>
      </div>
      {(sortedChildren.length > 0 || sortedSpecs.length > 0) && (
        <ul className="sb-tree__children">
          {sortedChildren.map((child) => (
            <CategoryNode
              key={child.path}
              node={child}
              onAddSpec={onAddSpec}
              issuesBySpecId={issuesBySpecId}
            />
          ))}
          {sortedSpecs.map((s) => {
            const issues = issuesBySpecId[s.id];
            return (
              <li key={s.id} className="sb-tree__spec">
                <NavLink
                  to={specRoute(s.id)}
                  className={({ isActive }) =>
                    isActive ? 'sb-tree__speclink sb-tree__speclink--active' : 'sb-tree__speclink'
                  }
                >
                  {s.title}
                  {issues && issues.length > 0 && <IssueBadge issues={issues} />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const { specs } = useSpecs();
  const { issuesBySpecId } = useValidation();
  const { openPalette } = useSearchPalette();
  const navigate = useNavigate();
  const [showCategory, setShowCategory] = useState(false);
  const [specDialogCategory, setSpecDialogCategory] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(specs), [specs]);
  const topLevel = useMemo(
    () => [...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [tree],
  );

  return (
    <aside className="sb-sidebar">
      <div className="sb-sidebar__brand">
        <Link to="/" className="sb-sidebar__brand-link">
          specbook
        </Link>
      </div>

      <button className="sb-search-btn" onClick={openPalette}>
        <span className="sb-search-btn__icon" aria-hidden="true">
          🔍
        </span>
        <span className="sb-search-btn__label">検索</span>
        <kbd className="sb-kbd">Ctrl+K</kbd>
      </button>

      <nav className="sb-sidebar__nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? 'sb-nav-link sb-nav-link--active' : 'sb-nav-link'
          }
        >
          ホーム
        </NavLink>
        <NavLink
          to="/graph"
          className={({ isActive }) =>
            isActive ? 'sb-nav-link sb-nav-link--active' : 'sb-nav-link'
          }
        >
          グラフ
        </NavLink>
      </nav>

      <div className="sb-sidebar__section-head">
        <span>カテゴリー</span>
        <button
          className="sb-icon-btn"
          title="新しいカテゴリー"
          onClick={() => setShowCategory(true)}
        >
          ＋
        </button>
      </div>

      <ul className="sb-tree">
        {topLevel.length === 0 && (
          <li className="sb-tree__empty">カテゴリーがありません</li>
        )}
        {topLevel.map((node) => (
          <CategoryNode
            key={node.path}
            node={node}
            onAddSpec={setSpecDialogCategory}
            issuesBySpecId={issuesBySpecId}
          />
        ))}
      </ul>

      {showCategory && (
        <NewCategoryDialog
          onClose={() => setShowCategory(false)}
          onCreated={(path) => {
            setShowCategory(false);
            navigate(`/specs/${path}`);
          }}
        />
      )}
      {specDialogCategory !== null && (
        <NewSpecDialog
          category={specDialogCategory}
          onClose={() => setSpecDialogCategory(null)}
          onCreated={(category, slug) => {
            setSpecDialogCategory(null);
            navigate(`${specRoute(`${category}:${slug}`)}?edit=1`);
          }}
        />
      )}
    </aside>
  );
}
