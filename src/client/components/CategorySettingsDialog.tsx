/**
 * Dialog for setting a category's display name + icon + color. Persists into the
 * category index (_.mdx) front-matter via PUT /api/categories/<category>. The Sidebar
 * and Link Graph update live afterwards (watcher → SpecsProvider refetch).
 */
import { useMemo, useState, type FormEvent } from 'react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { Modal } from './Modal';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { saveCategorySettings, ApiHttpError } from '../api';
import { PALETTE, hashCategoryColor } from '../pages/categoryColor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Curated, searchable subset of lucide icons offered in the picker. */
const ICON_CHOICES: string[] = [
  'database', 'table', 'layout', 'layout-dashboard', 'layout-grid',
  'globe', 'server', 'file-text', 'folder', 'box',
  'boxes', 'git-branch', 'settings', 'book', 'book-open',
  'bookmark', 'tag', 'tags', 'list', 'code',
  'terminal', 'cpu', 'hard-drive', 'cloud', 'network',
  'link', 'users', 'user', 'shield', 'key',
  'lock', 'bell', 'star', 'heart', 'flag',
  'map', 'map-pin', 'calendar', 'clock', 'image',
  'component', 'puzzle', 'layers', 'monitor', 'smartphone',
  'palette', 'zap', 'activity', 'package', 'workflow',
];

interface Props {
  /** Category path ("" = root). */
  category: string;
  onClose: () => void;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function CategorySettingsDialog({ category, onClose }: Props) {
  const { specs } = useSpecs();
  const { show } = useToast();

  // Current values from the category index front-matter.
  const indexSpec = useMemo(
    () => specs.find((s) => s.isIndex && s.category === category),
    [specs, category],
  );
  const [name, setName] = useState<string>(asString(indexSpec?.data['name']));
  const [icon, setIcon] = useState<string>(asString(indexSpec?.data['icon']));
  const [color, setColor] = useState<string>(asString(indexSpec?.data['color']));
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ICON_CHOICES.filter((n) => n.includes(q)) : ICON_CHOICES;
  }, [query]);

  const effectiveColor = color || hashCategoryColor(category);
  /** Folder path, used to identify the category in the title. */
  const label = category === '' ? '(root)' : category;
  /** Last path segment — the default sidebar label when no name is set. */
  const fallbackName = category === '' ? '(root)' : (category.split('/').pop() ?? category);
  const previewName = name.trim() || fallbackName;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveCategorySettings(category, { name, icon, color });
      show(`Updated "${label}"`);
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiHttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to save.';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Category settings — ${label}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        {/* Preview */}
        <div className="flex flex-col gap-1.5">
          <Label>Preview</Label>
          <div className="flex items-center gap-2 px-2.5 py-2 border border-border rounded-md bg-muted font-semibold">
            {icon ? (
              <DynamicIcon name={icon as IconName} size={18} color={effectiveColor} />
            ) : (
              <span
                className="inline-block rounded-full flex-shrink-0"
                style={{
                  width: 13,
                  height: 13,
                  background: effectiveColor,
                }}
              />
            )}
            <span>{previewName}</span>
          </div>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={fallbackName}
          />
          <span className="text-xs text-muted-foreground">
            Display name shown in the sidebar. Empty uses the folder name
            (<code>{fallbackName}</code>).
          </span>
        </div>

        {/* Color */}
        <div className="flex flex-col gap-1.5">
          <Label>Color</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  'w-[22px] h-[22px] rounded-full border-2 cursor-pointer p-0',
                  color === c
                    ? 'border-foreground shadow-[0_0_0_2px_var(--background)]'
                    : 'border-transparent',
                )}
                style={{ background: c }}
                title={c}
                aria-label={c}
                onClick={() => setColor(c)}
              />
            ))}
            <input
              type="color"
              className="w-7 h-7 p-0 border border-input rounded-md bg-background cursor-pointer"
              value={effectiveColor}
              title="Custom color"
              onChange={(e) => setColor(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setColor('')}
            >
              Default
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            Empty uses an auto color derived from the category name.
          </span>
        </div>

        {/* Icon */}
        <div className="flex flex-col gap-1.5">
          <Label>Icon</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter icons…"
          />
          <div className="grid grid-cols-8 gap-1 mt-2 max-h-[200px] overflow-y-auto p-0.5">
            <button
              type="button"
              className={cn(
                'flex items-center justify-center aspect-square border rounded-md text-sm cursor-pointer',
                !icon
                  ? 'border-primary bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--color-primary)]'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:border-primary',
              )}
              title="No icon"
              onClick={() => setIcon('')}
            >
              ∅
            </button>
            {filtered.map((n) => (
              <button
                key={n}
                type="button"
                className={cn(
                  'flex items-center justify-center aspect-square border rounded-md cursor-pointer',
                  icon === n
                    ? 'border-primary bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--color-primary)]'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:border-primary',
                )}
                title={n}
                aria-label={n}
                onClick={() => setIcon(n)}
              >
                <DynamicIcon name={n as IconName} size={18} color={effectiveColor} />
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-destructive text-[13px] m-0">{error}</p>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
