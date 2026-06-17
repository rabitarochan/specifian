/**
 * Spec view/edit page.
 * - Top bar: title + ID badge + view/edit toggle + (in edit mode) save
 * - Edit mode: left CodeMirror / right live preview (300ms debounce)
 * - Save: button + Ctrl+S → PUT → toast "Saved"
 * - Dirty indicator (●)
 * - WebSocket: auto-reload on external change when clean; show warning banner when dirty
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import type { SpecDetail, FsEvent, LintIssue } from '@shared/types';
import { fetchSpec, saveSpec, fetchCategorySchema, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { useValidation } from '../components/ValidationProvider';
import { useToast } from '../components/Toast';
import { useDebounced } from '../hooks/useDebounced';
import { MdxRenderer } from '../components/MdxRenderer';
import { GuidePanel } from '../components/GuidePanel';
import { Editor } from '../components/Editor';
import { PageContainer, PageBar, PageTitle, IdBadge, Loading } from '../components/Page';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { SchemaForm } from '../form/SchemaForm';
import type { JsonSchema } from '../form/schemaTypes';
import { splitFrontMatter, replaceFrontMatter } from '../form/yamlSync';
import { inferSchema } from '../form/infer';
import { READONLY } from '../env';

type EditTab = 'text' | 'form';

interface Props {
  category: string;
  slug: string;
  /** ID of the matching spec (e.g. "api/v1:users") */
  specId: string;
}

export function SpecPage({ category, slug, specId }: Props) {
  const { specs, onFsEvent } = useSpecs();
  const { issuesBySpecId } = useValidation();
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [externalChange, setExternalChange] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>('text');
  // Lint issues from the last save (shown in an amber banner)
  const [saveIssues, setSaveIssues] = useState<LintIssue[]>([]);
  // Per-category _schema.json cache (null = no schema)
  const [categorySchema, setCategorySchema] = useState<JsonSchema | null>(null);
  const [schemaCategory, setSchemaCategory] = useState<string | null>(null);

  // Static snapshots are read-only: never enter edit mode even if ?edit=1 is present.
  const editing = !READONLY && searchParams.get('edit') === '1';
  const dirty = detail !== null && text !== detail.content;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const debouncedText = useDebounced(text, 300);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setDetail(null);
        setLoadError(null);
        // Clear save issues when the spec changes
        setSaveIssues([]);
      }
      try {
        const d = await fetchSpec(category, slug);
        setDetail(d);
        setText(d.content);
        setExternalChange(false);
      } catch (err) {
        const msg =
          err instanceof ApiHttpError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load.';
        setLoadError(msg);
      }
    },
    [category, slug],
  );

  // Reload when the route changes
  useEffect(() => {
    void load();
  }, [load]);

  // Watch for external filesystem changes
  useEffect(() => {
    const unsub = onFsEvent((e: FsEvent) => {
      if (e.specId !== specId) return;
      if (e.event === 'unlink') {
        // File was deleted — show warning only
        setExternalChange(true);
        return;
      }
      if (!dirtyRef.current) {
        // Silently reload when there are no unsaved changes
        void load(true);
      } else {
        setExternalChange(true);
      }
    });
    return unsub;
  }, [onFsEvent, specId, load]);

  const doSave = useCallback(async () => {
    if (!detail || saving) return;
    setSaving(true);
    try {
      const res = await saveSpec(category, slug, text);
      setDetail({ meta: res.meta, content: text });
      setExternalChange(false);
      show('Saved');
      // Update save issues (clear if none)
      setSaveIssues(res.issues ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save.';
      show(msg);
    } finally {
      setSaving(false);
    }
  }, [detail, saving, category, slug, text, show]);

  // Ctrl+S save (edit mode only; works on both text and form tabs)
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void doSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, doSave]);

  // Fetch and cache the category's _schema.json once
  useEffect(() => {
    if (!editing || editTab !== 'form') return;
    if (schemaCategory === category) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchCategorySchema(category);
        if (cancelled) return;
        setCategorySchema(
          res.schema ? (res.schema as JsonSchema) : null,
        );
        setSchemaCategory(category);
      } catch {
        if (cancelled) return;
        // Fall back to inferred schema on fetch failure
        setCategorySchema(null);
        setSchemaCategory(category);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, editTab, category, schemaCategory]);

  const setEditing = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set('edit', '1');
    else next.delete('edit');
    setSearchParams(next, { replace: true });
  };

  if (loadError) {
    return (
      <PageContainer>
        <div
          className="my-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3.5"
          role="alert"
        >
          <div className="mb-1 font-bold text-destructive">Load Error</div>
          <div className="whitespace-pre-wrap font-mono text-[13px] text-[#991b1b]">
            {loadError}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!detail) return <Loading />;

  const previewContent = editing ? debouncedText : detail.content;
  const issues = issuesBySpecId[specId] ?? [];

  return (
    <div className="flex h-full flex-col">
      <PageBar tight>
        <div className="flex min-w-0 items-center gap-2.5">
          <PageTitle>
            {dirty && (
              <span className="mr-1 align-middle text-xs text-primary" title="Unsaved changes">
                ●
              </span>
            )}
            {detail.meta.title}
          </PageTitle>
          <IdBadge>{detail.meta.id}</IdBadge>
        </div>
        {!READONLY && (
          <div className="flex shrink-0 gap-2">
            {editing && (
              <Button
                onClick={() => void doSave()}
                disabled={saving || !dirty}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(!editing)}>
              {editing ? 'View' : 'Edit'}
            </Button>
          </div>
        )}
      </PageBar>

      {issues.length > 0 && (
        <div className={validationBannerClass} role="alert">
          <strong className="mb-1 block">Schema violations ({issues.length})</strong>
          <ul className={validationListClass}>
            {issues.map((issue, i) => (
              <li key={`${issue.path}:${i}`} className="my-0.5">
                <code className="font-mono text-xs">{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {saveIssues.length > 0 && (
        <div className={validationBannerClass} role="alert">
          <div className="flex items-center justify-between gap-2">
            <strong className="mb-1 block">
              {saveIssues.length} issue{saveIssues.length !== 1 ? 's' : ''} found on save
            </strong>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={() => setSaveIssues([])}
            >
              <X />
            </Button>
          </div>
          <ul className={validationListClass}>
            {saveIssues.map((issue, i) => (
              <li key={`${issue.rule}:${i}`} className="my-0.5">
                <code className="font-mono text-xs">[{issue.rule}]</code> {issue.message}
                {issue.line != null && ` (line ${issue.line})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {externalChange && (
        <div
          className="border-b border-[#fde68a] bg-[#fffbeb] px-10 py-2 text-[13.5px] text-[#92400e]"
          role="status"
        >
          This file was changed externally. Saving will overwrite those changes.
          <Button
            variant="link"
            size="sm"
            className="h-auto px-1 text-[#92400e]"
            onClick={() => void load()}
          >
            Reload
          </Button>
        </div>
      )}

      <GuidePanel category={category} defaultCollapsed />

      {editing ? (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-1/2 flex-col overflow-hidden border-r border-border">
            <div
              className="flex shrink-0 gap-1 border-b border-border bg-muted px-2.5 py-2"
              role="tablist"
              aria-label="Edit mode"
            >
              {(['text', 'form'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={editTab === tab}
                  onClick={() => setEditTab(tab)}
                  className={cn(
                    'rounded-md border border-transparent px-3.5 py-1 text-[13px] font-semibold capitalize text-muted-foreground transition-colors hover:text-foreground',
                    editTab === tab && 'border-border bg-background text-primary',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {editTab === 'text' ? (
                <Editor value={text} onChange={setText} />
              ) : (
                <FormPane
                  text={text}
                  categorySchema={categorySchema}
                  onChange={setText}
                />
              )}
            </div>
          </div>
          <div className="w-1/2 overflow-y-auto">
            <PageContainer preview>
              <MdxRenderer
                content={previewContent}
                specs={specs}
                category={category}
                slug={slug}
              />
            </PageContainer>
          </div>
        </div>
      ) : (
        <PageContainer>
          <MdxRenderer
            content={previewContent}
            specs={specs}
            category={category}
            slug={slug}
          />
        </PageContainer>
      )}
    </div>
  );
}

const validationBannerClass =
  'border-b border-[#fde68a] bg-[#fffbeb] px-10 py-2.5 text-[13.5px] text-[#92400e]';
const validationListClass = 'm-0 pl-[1.3em]';

/**
 * Form tab content. Parses front-matter from the current text and either:
 * - Shows an error box on parse failure
 * - Renders SchemaForm (schema = category schema ?? inferred)
 * Form changes are written back via replaceFrontMatter, updating the same text state
 * (dirty / Ctrl+S / live preview all continue to work as before).
 */
function FormPane({
  text,
  categorySchema,
  onChange,
}: {
  text: string;
  categorySchema: JsonSchema | null;
  onChange: (next: string) => void;
}) {
  const parts = splitFrontMatter(text);

  if (parts.error) {
    return (
      <div className="flex min-h-0 flex-1 overflow-y-auto px-5 pb-[60px] pt-[18px]">
        <div
          className="my-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3.5"
          role="alert"
        >
          <div className="mb-1 font-bold text-destructive">Cannot display form</div>
          <div className="whitespace-pre-wrap font-mono text-[13px] text-[#991b1b]">
            Failed to parse front-matter YAML: {parts.error}.
            Please fix it in the Text tab.
          </div>
        </div>
      </div>
    );
  }

  const data = parts.data;
  const schema: JsonSchema = categorySchema ?? inferSchema(data);

  const handleChange = (next: Record<string, unknown>): void => {
    onChange(replaceFrontMatter(text, next));
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto px-5 pb-[60px] pt-[18px]">
      <SchemaForm schema={schema} value={data} onChange={handleChange} />
    </div>
  );
}
