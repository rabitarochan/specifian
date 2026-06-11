/** スペックをリネームするダイアログ */
import { useState, useMemo, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from './Modal';
import { renameSpecId, ApiHttpError } from '../api';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { toSpecId, specRoute, parseSpecId } from '@shared/types';

interface Props {
  /** リネーム元のスペック ID ("category:slug") */
  specId: string;
  onClose: () => void;
}

/** スラッグの有効パターン */
const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;
const RESERVED_SLUGS = new Set(['_', '_template']);

export function RenameSpecDialog({ specId, onClose }: Props) {
  const parsed = parseSpecId(specId);
  const { specs, refetch } = useSpecs();
  const { show } = useToast();
  const navigate = useNavigate();
  // 現在のルートパラメーター ("*" splat) で表示中スペックを判定する
  const params = useParams<{ '*': string }>();

  const [category, setCategory] = useState(parsed?.category ?? '');
  const [slug, setSlug] = useState(parsed?.slug ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // サイドバーの datalist に使う既存カテゴリー一覧
  const categories = useMemo(
    () => [...new Set(specs.map((s) => s.category))].sort(),
    [specs],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cat = category.trim().replace(/^\/+|\/+$/g, '');
    const sl = slug.trim();

    if (!sl) {
      setError('スラッグを入力してください。');
      return;
    }
    if (!SLUG_PATTERN.test(sl)) {
      setError('スラッグは半角英数字・ハイフン・アンダーバーのみ使用できます。');
      return;
    }
    if (RESERVED_SLUGS.has(sl)) {
      setError(`スラッグ "${sl}" は予約済みです。`);
      return;
    }
    if (!cat) {
      setError('カテゴリーを入力してください。');
      return;
    }

    const toId = toSpecId(cat, sl);
    if (toId === specId) {
      onClose();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await renameSpecId(specId, toId);
      await refetch();
      show(`リネームしました（リンク ${res.rewrittenFiles.length} 件を書き換え）`);

      // 現在閲覧中のスペックがリネーム元ならば新ルートへ遷移
      const currentSplat = params['*'] ?? '';
      const oldParsed = parseSpecId(specId);
      if (oldParsed) {
        const oldSplat = `${oldParsed.category}/${oldParsed.slug}`;
        if (currentSplat === oldSplat) {
          navigate(specRoute(res.meta.id), { replace: true });
        }
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiHttpError && err.status === 409
          ? 'そのスペック ID は既に存在します。'
          : err instanceof ApiHttpError && err.status === 404
            ? 'リネーム元のスペックが見つかりません。'
            : err instanceof ApiHttpError && err.status === 400
              ? err.message
              : err instanceof Error
                ? err.message
                : 'リネームに失敗しました。';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal title="スペックをリネーム" onClose={onClose}>
      <form onSubmit={submit} className="sb-form">
        <div className="sb-field">
          <span className="sb-field__label">現在の ID</span>
          <span className="sb-id-badge" style={{ alignSelf: 'flex-start' }}>{specId}</span>
        </div>

        <label className="sb-field">
          <span className="sb-field__label">カテゴリー</span>
          <input
            className="sb-input"
            list="rename-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="tables"
            autoFocus
            disabled={busy}
          />
          <datalist id="rename-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="sb-field">
          <span className="sb-field__label">スラッグ</span>
          <input
            className="sb-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="users"
            pattern="[A-Za-z0-9_\-]+"
            disabled={busy}
          />
          <span className="sb-field__hint">半角英数字・ハイフン・アンダーバーのみ</span>
        </label>

        {error && <p className="sb-form__error">{error}</p>}

        <div className="sb-form__actions">
          <button type="button" className="sb-btn" onClick={onClose} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={busy}>
            {busy ? 'リネーム中…' : 'リネーム'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
