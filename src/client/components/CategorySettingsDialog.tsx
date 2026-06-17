/**
 * Dialog for setting a category's icon + color. Persists into the category index
 * (_.mdx) front-matter via PUT /api/categories/<category>. The Sidebar and Link Graph
 * update live afterwards (watcher → SpecsProvider refetch).
 */
import { useMemo, useState, type FormEvent } from 'react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { Modal } from './Modal';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { saveCategorySettings, ApiHttpError } from '../api';
import { PALETTE, hashCategoryColor } from '../pages/categoryColor';

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
  const label = category === '' ? '(root)' : category;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveCategorySettings(category, { icon, color });
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
      <form onSubmit={submit} className="sb-form">
        {/* Preview */}
        <div className="sb-field">
          <span className="sb-field__label">Preview</span>
          <div className="sb-cat-preview">
            {icon ? (
              <DynamicIcon name={icon as IconName} size={18} color={effectiveColor} />
            ) : (
              <span
                className="sb-cat-swatch"
                style={{
                  display: 'inline-block',
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  background: effectiveColor,
                }}
              />
            )}
            <span>{label}</span>
          </div>
        </div>

        {/* Color */}
        <div className="sb-field">
          <span className="sb-field__label">Color</span>
          <div className="sb-color-row">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={
                  color === c ? 'sb-color-swatch sb-color-swatch--active' : 'sb-color-swatch'
                }
                style={{ background: c }}
                title={c}
                aria-label={c}
                onClick={() => setColor(c)}
              />
            ))}
            <input
              type="color"
              className="sb-color-custom"
              value={effectiveColor}
              title="Custom color"
              onChange={(e) => setColor(e.target.value)}
            />
            <button
              type="button"
              className="sb-btn sb-btn--ghost"
              onClick={() => setColor('')}
            >
              Default
            </button>
          </div>
          <span className="sb-field__hint">
            Empty uses an auto color derived from the category name.
          </span>
        </div>

        {/* Icon */}
        <div className="sb-field">
          <span className="sb-field__label">Icon</span>
          <input
            className="sb-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter icons…"
          />
          <div className="sb-icon-grid">
            <button
              type="button"
              className={!icon ? 'sb-icon-cell sb-icon-cell--active' : 'sb-icon-cell'}
              title="No icon"
              onClick={() => setIcon('')}
            >
              ∅
            </button>
            {filtered.map((n) => (
              <button
                key={n}
                type="button"
                className={
                  icon === n ? 'sb-icon-cell sb-icon-cell--active' : 'sb-icon-cell'
                }
                title={n}
                aria-label={n}
                onClick={() => setIcon(n)}
              >
                <DynamicIcon name={n as IconName} size={18} color={effectiveColor} />
              </button>
            ))}
          </div>
        </div>

        {error && <p className="sb-form__error">{error}</p>}
        <div className="sb-form__actions">
          <button type="button" className="sb-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
