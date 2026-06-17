/**
 * Authoring guide panel.
 * Fetches the `_guide.md` for a category (empty category = root) and renders its
 * Markdown body as a collapsible callout. Authors can toggle into an editor to
 * update the guide (Save → PUT /api/guide). Live-refreshes on `_guide.md` fs events.
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { FsEvent } from '@shared/types';
import { fetchGuide, saveGuide } from '../api';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { MdxRenderer } from './MdxRenderer';
import { Editor } from './Editor';
import { splitFrontMatter } from '../form/yamlSync';
import { READONLY } from '../env';
import { Button } from '@/components/ui/button';

interface Props {
  /** Category path ("" = root). The guide path is `${category}/_guide.md` (or `_guide.md`). */
  category: string;
  /** Whether the panel starts collapsed. */
  defaultCollapsed?: boolean;
}

/** Relative `_guide.md` path for a category ("" = root). */
function guidePath(category: string): string {
  return category ? `${category}/_guide.md` : '_guide.md';
}

export function GuidePanel({ category, defaultCollapsed = false }: Props) {
  const { specs, onFsEvent } = useSpecs();
  const { show } = useToast();

  const [raw, setRaw] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchGuide(category);
      setRaw(res.guide);
    } catch {
      // On fetch failure, treat as no guide
      setRaw(null);
    } finally {
      setLoaded(true);
    }
  }, [category]);

  useEffect(() => {
    setLoaded(false);
    setEditing(false);
    void load();
  }, [load]);

  // Live refresh when this category's _guide.md changes externally.
  useEffect(() => {
    const target = guidePath(category);
    const unsub = onFsEvent((e: FsEvent) => {
      if (e.path === target) void load();
    });
    return unsub;
  }, [onFsEvent, category, load]);

  const startEdit = () => {
    setDraft(raw ?? '');
    setEditing(true);
  };

  const doSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await saveGuide(category, draft);
      setRaw(res.guide);
      setEditing(false);
      show('Saved');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }, [saving, category, draft, show]);

  // Don't render anything until the first fetch resolves (avoids a flash).
  if (!loaded) return null;
  // In read-only mode there's nothing to show when a category has no guide.
  if (READONLY && raw == null) return null;

  const parts = raw != null ? splitFrontMatter(raw) : null;
  const heading =
    (parts?.hasFrontMatter && typeof parts.data.title === 'string'
      ? (parts.data.title as string)
      : null) ?? 'Authoring guide';
  const body = parts ? parts.body : '';

  return (
    <section className="border border-border border-l-[3px] border-l-primary bg-accent rounded-md mb-5">
      {/* Header bar */}
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 flex-1 min-w-0 border-0 bg-transparent text-foreground cursor-pointer p-0 text-left"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? (
            <ChevronRight className="size-3 text-primary flex-shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3 text-primary flex-shrink-0" aria-hidden="true" />
          )}
          <span className="text-[13.5px] font-semibold text-[#4338ca]">{heading}</span>
        </button>
        {!READONLY && !collapsed && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            Edit
          </Button>
        )}
      </header>

      {!collapsed && (
        <div className="border-t border-border bg-background px-4 py-3 rounded-b-md">
          {editing ? (
            <>
              {/* CodeMirror editor box — fixed 320px height, cm-editor fills it */}
              <div className="h-80 border border-input rounded-md overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto">
                <Editor value={draft} onChange={setDraft} />
              </div>
              <div className="flex justify-end gap-2 mt-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void doSave()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </>
          ) : raw == null || body.trim() === '' ? (
            <p className="m-0 text-muted-foreground text-[13.5px]">No guide yet.</p>
          ) : (
            // Render the raw guide (front-matter included). remark-frontmatter consumes
            // and hides the front-matter — same path specs use. Passing the front-matter-
            // stripped body instead triggers a `data` redeclaration conflict in compileMdx.
            <MdxRenderer
              content={raw}
              specs={specs}
              category={category}
              slug="_guide"
            />
          )}
        </div>
      )}
    </section>
  );
}
