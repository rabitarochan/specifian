/**
 * Left sidebar: app name + nav (Home/Graph) + category tree.
 * Categories are expanded into a tree from nested paths (e.g. `api/v1`).
 * Header has a "New Category" button; each category has an "Add Spec" button.
 * Spec rows have a "⋯" hover menu (Rename / Delete).
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { SpecMeta } from '@shared/types';
import { specRoute } from '@shared/types';
import type { ValidationIssue } from '@shared/types';
import { useSpecs } from './SpecsProvider';
import { useValidation } from './ValidationProvider';
import { useSearchPalette } from './SearchPalette';
import { NewCategoryDialog } from './NewCategoryDialog';
import { NewSpecDialog } from './NewSpecDialog';
import { RenameSpecDialog } from './RenameSpecDialog';
import { DeleteSpecDialog } from './DeleteSpecDialog';

interface TreeNode {
  /** Full path of this node (e.g. "api", "api/v1") */
  path: string;
  /** Display name (last path segment) */
  name: string;
  children: Map<string, TreeNode>;
  /** Specs directly belonging to this category (excluding index and template) */
  specs: SpecMeta[];
  /** Whether this category exists (has at least one spec or a child) */
}

function buildTree(specs: SpecMeta[]): TreeNode {
  const root: TreeNode = { path: '', name: '', children: new Map(), specs: [] };
  // Enumerate all categories (even empty ones that only have _ / _template)
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

/** Schema-violation badge shown on spec rows */
function IssueBadge({ issues }: { issues: ValidationIssue[] }) {
  const title = `${issues.length} schema violation${issues.length !== 1 ? 's' : ''}\n${issues
    .map((i) => `${i.path}: ${i.message}`)
    .join('\n')}`;
  return (
    <span className="sb-issue-badge" title={title} aria-label={title}>
      ⚠
    </span>
  );
}

/**
 * ⋯ popover menu that appears on hover for a spec row.
 * Provides two actions: Rename and Delete.
 * Closes on outside click or Escape.
 */
function SpecRowMenu({
  specId,
  onRename,
  onDelete,
}: {
  specId: string;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="sb-row-menu-wrap" ref={menuRef}>
      <button
        className="sb-icon-btn sb-tree__more"
        title="Menu"
        aria-label="Open menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && (
        <div className="sb-row-menu" role="menu">
          <button
            className="sb-row-menu__item"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRename(specId);
            }}
          >
            Rename
          </button>
          <button
            className="sb-row-menu__item sb-row-menu__item--danger"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete(specId);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryNode({
  node,
  onAddSpec,
  onRenameSpec,
  onDeleteSpec,
  issuesBySpecId,
}: {
  node: TreeNode;
  onAddSpec: (category: string) => void;
  onRenameSpec: (id: string) => void;
  onDeleteSpec: (id: string) => void;
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
          title="Add spec"
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
              onRenameSpec={onRenameSpec}
              onDeleteSpec={onDeleteSpec}
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
                <SpecRowMenu
                  specId={s.id}
                  onRename={onRenameSpec}
                  onDelete={onDeleteSpec}
                />
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
  const [renameSpecId, setRenameSpecId] = useState<string | null>(null);
  const [deleteSpecId, setDeleteSpecId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(specs), [specs]);
  const topLevel = useMemo(
    () => [...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [tree],
  );

  return (
    <aside className="sb-sidebar">
      <div className="sb-sidebar__brand">
        <Link to="/" className="sb-sidebar__brand-link">
          specifian
        </Link>
      </div>

      <button className="sb-search-btn" onClick={openPalette}>
        <span className="sb-search-btn__icon" aria-hidden="true">
          🔍
        </span>
        <span className="sb-search-btn__label">Search</span>
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
          Home
        </NavLink>
        <NavLink
          to="/graph"
          className={({ isActive }) =>
            isActive ? 'sb-nav-link sb-nav-link--active' : 'sb-nav-link'
          }
        >
          Graph
        </NavLink>
      </nav>

      <div className="sb-sidebar__section-head">
        <span>Categories</span>
        <button
          className="sb-icon-btn"
          title="New category"
          onClick={() => setShowCategory(true)}
        >
          ＋
        </button>
      </div>

      <ul className="sb-tree">
        {topLevel.length === 0 && (
          <li className="sb-tree__empty">No categories</li>
        )}
        {topLevel.map((node) => (
          <CategoryNode
            key={node.path}
            node={node}
            onAddSpec={setSpecDialogCategory}
            onRenameSpec={setRenameSpecId}
            onDeleteSpec={setDeleteSpecId}
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
      {renameSpecId !== null && (
        <RenameSpecDialog
          specId={renameSpecId}
          onClose={() => setRenameSpecId(null)}
        />
      )}
      {deleteSpecId !== null && (
        <DeleteSpecDialog
          specId={deleteSpecId}
          onClose={() => setDeleteSpecId(null)}
        />
      )}
    </aside>
  );
}
