/**
 * スペック表示/編集ページ。
 * - 上部バー: タイトル + ID バッジ + 表示/編集トグル + (編集時) 保存
 * - 編集モード: 左 CodeMirror / 右ライブプレビュー (300ms デバウンス)
 * - 保存: ボタン + Ctrl+S → PUT → トースト「保存しました」
 * - dirty インジケーター (●)
 * - WebSocket: 外部変更時、未編集なら自動再取得、編集中なら警告バナー
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SpecDetail, FsEvent } from '@shared/types';
import { fetchSpec, saveSpec, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { useToast } from '../components/Toast';
import { useDebounced } from '../hooks/useDebounced';
import { MdxRenderer } from '../components/MdxRenderer';
import { Editor } from '../components/Editor';

interface Props {
  category: string;
  slug: string;
  /** 一致するスペックの ID ("api/v1:users") */
  specId: string;
}

export function SpecPage({ category, slug, specId }: Props) {
  const { specs, onFsEvent } = useSpecs();
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [externalChange, setExternalChange] = useState(false);

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
              : '読み込みに失敗しました。';
        setLoadError(msg);
      }
    },
    [category, slug],
  );

  // ルート変更で再読み込み
  useEffect(() => {
    void load();
  }, [load]);

  // 外部 fs 変更の監視
  useEffect(() => {
    const unsub = onFsEvent((e: FsEvent) => {
      if (e.specId !== specId) return;
      if (e.event === 'unlink') {
        // 削除された場合は警告のみ
        setExternalChange(true);
        return;
      }
      if (!dirtyRef.current) {
        // 未編集なら静かに再取得
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
      const { meta } = await saveSpec(category, slug, text);
      setDetail({ meta, content: text });
      setExternalChange(false);
      show('保存しました');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存に失敗しました。';
      show(msg);
    } finally {
      setSaving(false);
    }
  }, [detail, saving, category, slug, text, show]);

  // Ctrl+S 保存 (編集モードのみ)
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
          <div className="sb-error-panel__title">読み込みエラー</div>
          <div className="sb-error-panel__message">{loadError}</div>
        </div>
      </article>
    );
  }

  if (!detail) return <div className="sb-loading">読み込み中…</div>;

  const previewContent = editing ? debouncedText : detail.content;

  return (
    <div className="sb-spec-page">
      <header className="sb-page-bar">
        <div className="sb-page-bar__main">
          <h1 className="sb-page-bar__title">
            {dirty && <span className="sb-dirty" title="未保存の変更">●</span>}
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
              {saving ? '保存中…' : '保存'}
            </button>
          )}
          <button
            className="sb-btn"
            onClick={() => setEditing(!editing)}
          >
            {editing ? '表示' : '編集'}
          </button>
        </div>
      </header>

      {externalChange && (
        <div className="sb-banner" role="status">
          このファイルは外部で変更されました。保存すると上書きします。
          <button className="sb-link-btn" onClick={() => void load()}>
            再読み込み
          </button>
        </div>
      )}

      {editing ? (
        <div className="sb-split">
          <div className="sb-split__editor">
            <Editor value={text} onChange={setText} />
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
