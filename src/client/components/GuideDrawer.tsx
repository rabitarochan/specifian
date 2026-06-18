/**
 * Authoring-guide drawer.
 *
 * Opened from the page-bar "Guide" toggle (GuideToggleButton); when closed nothing
 * is docked. Open → a fixed-width, independently scrolling panel docked to the right
 * edge that pushes the content column, so the guide can be read while a spec is being
 * written. Authors can toggle into an editor (Save → PUT /api/guide).
 *
 * All state lives in GuideProvider; this component is purely presentational plus
 * its own local edit-mode UI state.
 */
import { useEffect, useState } from 'react';
import { BookOpen, Edit, PanelRightClose, Save } from 'lucide-react';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { useGuide } from './GuideProvider';
import { MdxRenderer } from './MdxRenderer';
import { Editor } from './Editor';
import { splitFrontMatter } from '../form/yamlSync';
import { READONLY } from '../env';
import { Button } from '@/components/ui/button';

export function GuideDrawer() {
  const { category, available, open, setOpen, raw, save } = useGuide();
  const { specs } = useSpecs();
  const { show } = useToast();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Leave edit mode whenever the active guide changes or the drawer closes.
  useEffect(() => {
    setEditing(false);
  }, [category, open]);

  // Closed (or no guide available): nothing is docked. The drawer is opened from
  // the page-bar "Guide" toggle (GuideToggleButton).
  if (!available || !open) return null;

  const parts = raw != null ? splitFrontMatter(raw) : null;
  const heading =
    (parts?.hasFrontMatter && typeof parts.data.title === 'string'
      ? (parts.data.title as string)
      : null) ?? 'Authoring guide';
  const body = parts ? parts.body : '';

  const startEdit = () => {
    setDraft(raw ?? '');
    setEditing(true);
  };

  const doSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await save(draft);
      setEditing(false);
      show('Saved');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-accent px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate text-[13.5px] font-semibold text-[#4338ca]">
            {heading}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!READONLY && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Edit />
              Edit
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close authoring guide"
            onClick={() => setOpen(false)}
          >
            <PanelRightClose />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {editing ? (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-input [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto">
              <Editor value={draft} onChange={setDraft} />
            </div>
            <div className="mt-2.5 flex shrink-0 justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => void doSave()} disabled={saving}>
                {saving ? (
                  'Saving…'
                ) : (
                  <>
                    <Save />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : raw == null || body.trim() === '' ? (
          <p className="m-0 text-[13.5px] text-muted-foreground">No guide yet.</p>
        ) : (
          // Render the raw guide (front-matter included). remark-frontmatter consumes
          // and hides the front-matter — same path specs use.
          <MdxRenderer
            content={raw}
            specs={specs}
            category={category ?? ''}
            slug="_guide"
          />
        )}
      </div>
    </aside>
  );
}

/** Page-bar toggle that opens/closes the guide drawer. Hidden when no guide is available. */
export function GuideToggleButton() {
  const { available, open, toggle } = useGuide();
  if (!available) return null;
  return (
    <Button
      variant="outline"
      onClick={toggle}
      aria-pressed={open}
      className={open ? 'border-primary text-primary' : undefined}
    >
      <BookOpen className="size-4" aria-hidden="true" />
      Guide
    </Button>
  );
}
