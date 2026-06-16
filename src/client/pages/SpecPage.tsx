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
import type { SpecDetail, FsEvent, LintIssue } from '@shared/types';
import { fetchSpec, saveSpec, fetchCategorySchema, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { useValidation } from '../components/ValidationProvider';
import { useToast } from '../components/Toast';
import { useDebounced } from '../hooks/useDebounced';
import { MdxRenderer } from '../components/MdxRenderer';
import { Editor } from '../components/Editor';
import { SchemaForm } from '../form/SchemaForm';
import type { JsonSchema } from '../form/schemaTypes';
import { splitFrontMatter, replaceFrontMatter } from '../form/yamlSync';
import { inferSchema } from '../form/infer';

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

  const editing = searchParams.get('edit') === '1';
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
      <article className="sb-content">
        <div className="sb-error-panel" role="alert">
          <div className="sb-error-panel__title">Load Error</div>
          <div className="sb-error-panel__message">{loadError}</div>
        </div>
      </article>
    );
  }

  if (!detail) return <div className="sb-loading">Loading…</div>;

  const previewContent = editing ? debouncedText : detail.content;
  const issues = issuesBySpecId[specId] ?? [];

  return (
    <div className="sb-spec-page">
      <header className="sb-page-bar">
        <div className="sb-page-bar__main">
          <h1 className="sb-page-bar__title">
            {dirty && <span className="sb-dirty" title="Unsaved changes">●</span>}
            {detail.meta.title}
          </h1>
          <span className="sb-id-badge">{detail.meta.id}</span>
        </div>
        <div className="sb-page-bar__actions">
          {editing && (
            <button
              className="sb-btn sb-btn--primary"
              onClick={() => void doSave()}
              disabled={saving || !dirty}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          <button
            className="sb-btn"
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'View' : 'Edit'}
          </button>
        </div>
      </header>

      {issues.length > 0 && (
        <div className="sb-validation-banner" role="alert">
          <strong className="sb-validation-banner__title">
            Schema violations ({issues.length})
          </strong>
          <ul className="sb-validation-banner__list">
            {issues.map((issue, i) => (
              <li key={`${issue.path}:${i}`}>
                <code>{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {saveIssues.length > 0 && (
        <div className="sb-validation-banner sb-save-issues-banner" role="alert">
          <div className="sb-save-issues-banner__head">
            <strong className="sb-validation-banner__title">
              {saveIssues.length} issue{saveIssues.length !== 1 ? 's' : ''} found on save
            </strong>
            <button
              className="sb-icon-btn"
              aria-label="Close"
              onClick={() => setSaveIssues([])}
            >
              ✕
            </button>
          </div>
          <ul className="sb-validation-banner__list">
            {saveIssues.map((issue, i) => (
              <li key={`${issue.rule}:${i}`}>
                <code>[{issue.rule}]</code> {issue.message}
                {issue.line != null && ` (line ${issue.line})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {externalChange && (
        <div className="sb-banner" role="status">
          This file was changed externally. Saving will overwrite those changes.
          <button className="sb-link-btn" onClick={() => void load()}>
            Reload
          </button>
        </div>
      )}

      {editing ? (
        <div className="sb-split">
          <div className="sb-split__editor">
            <div className="sb-edit-tabs" role="tablist" aria-label="Edit mode">
              <button
                type="button"
                role="tab"
                aria-selected={editTab === 'text'}
                className={`sb-edit-tab${editTab === 'text' ? ' sb-edit-tab--active' : ''}`}
                onClick={() => setEditTab('text')}
              >
                Text
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={editTab === 'form'}
                className={`sb-edit-tab${editTab === 'form' ? ' sb-edit-tab--active' : ''}`}
                onClick={() => setEditTab('form')}
              >
                Form
              </button>
            </div>
            <div className="sb-edit-pane">
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
          <div className="sb-split__preview">
            <article className="sb-content sb-content--preview">
              <MdxRenderer
                content={previewContent}
                specs={specs}
                category={category}
                slug={slug}
              />
            </article>
          </div>
        </div>
      ) : (
        <article className="sb-content">
          <MdxRenderer
            content={previewContent}
            specs={specs}
            category={category}
            slug={slug}
          />
        </article>
      )}
    </div>
  );
}

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
      <div className="sb-form-pane">
        <div className="sb-error-panel" role="alert">
          <div className="sb-error-panel__title">Cannot display form</div>
          <div className="sb-error-panel__message">
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
    <div className="sb-form-pane">
      <SchemaForm schema={schema} value={data} onChange={handleChange} />
    </div>
  );
}
