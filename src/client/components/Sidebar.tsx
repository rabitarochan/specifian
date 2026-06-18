/**
 * Left sidebar: app name + nav (Home/Graph) + category tree.
 * Categories are expanded into a tree from nested paths (e.g. `api/v1`).
 * Header has a "New Category" button; each category has an "Add Spec" button.
 * Spec rows have a "⋯" hover menu (Rename / Delete).
 */
import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Plus, MoreHorizontal, TriangleAlert } from 'lucide-react';
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
import { CategorySettingsDialog } from './CategorySettingsDialog';
import { CategoryIcon } from './CategoryIcon';
import { Button } from './ui/button';
import { useCategoryStyles } from '../hooks/useCategoryStyles';
import { cn } from '../lib/utils';
import { READONLY } from '../env';

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
    // The root category ("") is the project index (.specs/_.mdx, the "Home" page);
    // it must not appear as a category row. Map it to the root node itself instead of
    // creating an empty-named child.
    if (catPath === '') return root;
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
    <span title={title} aria-label={title} className="inline-flex align-middle">
      <TriangleAlert className="ml-1.5 size-3 text-amber-600" />
    </span>
  );
}

/** Shared row popover menu (positioned under a "⋯" trigger). */
function RowMenu({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: (close: () => void) => ReactNode;
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
    <div className="relative flex items-center" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[open=true]:opacity-100"
        data-open={open}
        title="Menu"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+2px)] z-[200] min-w-[120px] overflow-hidden rounded-md border border-input bg-popover py-1 shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const menuItemClass =
  'block w-full px-3.5 py-1.5 text-left text-[13.5px] text-foreground transition-colors hover:bg-muted';

function CategoryNode({
  node,
  onAddSpec,
  onRenameSpec,
  onDeleteSpec,
  onSettings,
  issuesBySpecId,
}: {
  node: TreeNode;
  onAddSpec: (category: string) => void;
  onRenameSpec: (id: string) => void;
  onDeleteSpec: (id: string) => void;
  onSettings: (category: string) => void;
  issuesBySpecId: Record<string, ValidationIssue[]>;
}) {
  const { categoryColor, categoryIcon } = useCategoryStyles();
  const sortedChildren = useMemo(
    () => [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [node],
  );
  const sortedSpecs = useMemo(
    () => [...node.specs].sort((a, b) => a.title.localeCompare(b.title)),
    [node.specs],
  );

  return (
    <li>
      <div className="group flex items-center gap-0.5">
        <NavLink
          to={`/specs/${node.path}`}
          className={({ isActive }) =>
            cn(
              'block flex-1 truncate rounded-md px-2 py-1.5 text-sm font-semibold text-foreground hover:bg-accent hover:no-underline',
              isActive && 'text-primary',
            )
          }
        >
          <span className="mr-1.5 inline-flex w-4 items-center justify-center align-middle" aria-hidden="true">
            <CategoryIcon
              name={categoryIcon(node.path)}
              color={categoryColor(node.path)}
              size={14}
            />
          </span>
          {node.name}
        </NavLink>
        {!READONLY && (
          <>
            <RowMenu ariaLabel="Open category menu">
              {(close) => (
                <button
                  className={menuItemClass}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                    onSettings(node.path);
                  }}
                >
                  Icon &amp; color…
                </button>
              )}
            </RowMenu>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              title="Add spec"
              aria-label="Add spec"
              onClick={() => onAddSpec(node.path)}
            >
              <Plus />
            </Button>
          </>
        )}
      </div>
      {(sortedChildren.length > 0 || sortedSpecs.length > 0) && (
        <ul className="ml-2 list-none border-l border-border pl-3">
          {sortedChildren.map((child) => (
            <CategoryNode
              key={child.path}
              node={child}
              onAddSpec={onAddSpec}
              onRenameSpec={onRenameSpec}
              onDeleteSpec={onDeleteSpec}
              onSettings={onSettings}
              issuesBySpecId={issuesBySpecId}
            />
          ))}
          {sortedSpecs.map((s) => {
            const issues = issuesBySpecId[s.id];
            return (
              <li key={s.id} className="group relative flex items-center">
                <NavLink
                  to={specRoute(s.id)}
                  className={({ isActive }) =>
                    cn(
                      'block min-w-0 flex-1 truncate rounded-md px-2 py-1 text-[13.5px] text-muted-foreground hover:bg-accent hover:text-foreground hover:no-underline',
                      isActive && 'bg-accent font-semibold text-primary',
                    )
                  }
                >
                  {s.title}
                  {issues && issues.length > 0 && <IssueBadge issues={issues} />}
                </NavLink>
                {!READONLY && (
                  <RowMenu ariaLabel="Open menu">
                    {(close) => (
                      <>
                        <button
                          className={menuItemClass}
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            close();
                            onRenameSpec(s.id);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          className={cn(
                            menuItemClass,
                            'text-destructive hover:bg-destructive/10',
                          )}
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            close();
                            onDeleteSpec(s.id);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </RowMenu>
                )}
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
  const [settingsCategory, setSettingsCategory] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(specs), [specs]);
  const topLevel = useMemo(
    () => [...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [tree],
  );

  return (
    <aside className="h-full w-[260px] shrink-0 overflow-y-auto border-r border-border bg-sidebar px-3 pb-8 pt-4">
      <div className="px-2 pb-4 pt-1">
        <Link
          to="/"
          className="text-xl font-bold tracking-tight text-foreground hover:no-underline"
        >
          Specifian
        </Link>
      </div>

      <button
        onClick={openPalette}
        className="mb-3.5 flex w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-muted-foreground transition-colors hover:border-primary hover:bg-accent"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="flex-1 text-left text-[13.5px]">Search</span>
        <kbd className="rounded border border-b-2 border-border bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">
          Ctrl+K
        </kbd>
      </button>

      <nav className="mb-[18px] flex flex-col gap-0.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'block rounded-md px-2.5 py-1.5 font-medium text-foreground hover:bg-accent hover:no-underline',
              isActive && 'bg-accent text-primary',
            )
          }
        >
          Home
        </NavLink>
        <NavLink
          to="/graph"
          className={({ isActive }) =>
            cn(
              'block rounded-md px-2.5 py-1.5 font-medium text-foreground hover:bg-accent hover:no-underline',
              isActive && 'bg-accent text-primary',
            )
          }
        >
          Graph
        </NavLink>
      </nav>

      <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Categories</span>
        {!READONLY && (
          <Button
            variant="ghost"
            size="icon"
            title="New category"
            aria-label="New category"
            onClick={() => setShowCategory(true)}
          >
            <Plus />
          </Button>
        )}
      </div>

      <ul className="list-none">
        {topLevel.length === 0 && (
          <li className="px-2.5 py-1.5 text-[13px] text-muted-foreground">No categories</li>
        )}
        {topLevel.map((node) => (
          <CategoryNode
            key={node.path}
            node={node}
            onAddSpec={setSpecDialogCategory}
            onRenameSpec={setRenameSpecId}
            onDeleteSpec={setDeleteSpecId}
            onSettings={setSettingsCategory}
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
      {settingsCategory !== null && (
        <CategorySettingsDialog
          category={settingsCategory}
          onClose={() => setSettingsCategory(null)}
        />
      )}
    </aside>
  );
}
