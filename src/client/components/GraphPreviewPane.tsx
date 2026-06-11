/**
 * グラフのノード選択時に右ペインへ表示するプレビュー。
 * - ヘッダー: タイトル + ID バッジ + 「ページを開く」 + ✕ 閉じる
 * - 本文: fetchSpec で取得した MDX を MdxRenderer で描画 (.sb-content 風のパディング)
 * - 状態: 読み込み中 / 取得エラー、selected 変化で再取得 (stale 結果は破棄)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpecDetail } from '@shared/types';
import { parseSpecId, specRoute } from '@shared/types';
import { fetchSpec, ApiHttpError } from '../api';
import { useSpecs } from './SpecsProvider';
import { MdxRenderer } from './MdxRenderer';

interface Props {
  /** 選択中のスペック ID ("tables:users") */
  id: string;
  /** グラフが解決しているタイトル (取得前のヘッダー表示用) */
  title: string;
  onClose: () => void;
  /** プレビュー内の wiki リンクで選択スペックを切り替える */
  onSelect: (id: string) => void;
}

export function GraphPreviewPane({ id, title, onClose, onSelect }: Props) {
  const navigate = useNavigate();
  const { specs } = useSpecs();
  const parsed = parseSpecId(id);

  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed) {
      setDetail(null);
      setError('不正なスペック ID です。');
      return;
    }
    let active = true;
    setDetail(null);
    setError(null);
    fetchSpec(parsed.category, parsed.slug)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg =
          err instanceof ApiHttpError
            ? err.message
            : err instanceof Error
              ? err.message
              : '読み込みに失敗しました。';
        setError(msg);
      });
    return () => {
      active = false;
    };
    // category / slug が変われば再取得
  }, [parsed?.category, parsed?.slug]);

  const headerTitle = detail?.meta.title ?? title;

  return (
    <div className="sb-graph-preview">
      <header className="sb-graph-preview__header">
        <span className="sb-graph-preview__title" title={headerTitle}>
          {headerTitle}
        </span>
        <span className="sb-id-badge">{id}</span>
        <div className="sb-graph-preview__actions">
          <button
            className="sb-btn sb-btn--primary"
            onClick={() => navigate(specRoute(id))}
          >
            ページを開く
          </button>
          <button
            className="sb-icon-btn"
            onClick={onClose}
            aria-label="プレビューを閉じる"
            title="閉じる"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="sb-graph-preview__body">
        {error ? (
          <div className="sb-error-panel" role="alert">
            <div className="sb-error-panel__title">読み込みエラー</div>
            <div className="sb-error-panel__message">{error}</div>
          </div>
        ) : !detail || !parsed ? (
          <div className="sb-loading">読み込み中…</div>
        ) : (
          <MdxRenderer
            content={detail.content}
            specs={specs}
            category={parsed.category}
            slug={parsed.slug}
            onWikiNavigate={onSelect}
          />
        )}
      </div>
    </div>
  );
}
