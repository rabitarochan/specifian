/** スペックを削除するダイアログ。参照元を事前に確認してから確認削除する */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from './Modal';
import { deleteSpecById, fetchRefs, ApiHttpError } from '../api';
import { useSpecs } from './SpecsProvider';
import { useToast } from './Toast';
import { parseSpecId } from '@shared/types';

interface Props {
  /** 削除対象のスペック ID ("category:slug") */
  specId: string;
  onClose: () => void;
}

export function DeleteSpecDialog({ specId, onClose }: Props) {
  const parsed = parseSpecId(specId);
  const { refetch } = useSpecs();
  const { show } = useToast();
  const navigate = useNavigate();
  const params = useParams<{ '*': string }>();

  const [refs, setRefs] = useState<string[] | null>(null);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ダイアログを開いたときに参照元を取得する
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchRefs(specId);
        if (!cancelled) setRefs(res.refs);
      } catch (err) {
        if (!cancelled) {
          setRefsError(err instanceof Error ? err.message : '参照の取得に失敗しました。');
          setRefs([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [specId]);

  const doDelete = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSpecById(parsed.category, parsed.slug);
      await refetch();
      show('削除しました');

      // 現在閲覧中のスペックが削除対象ならばホームへ遷移
      const currentSplat = params['*'] ?? '';
      const expectedSplat = `${parsed.category}/${parsed.slug}`;
      if (currentSplat === expectedSplat) {
        navigate('/', { replace: true });
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiHttpError && err.status === 404
          ? 'スペックが見つかりません。'
          : err instanceof Error
            ? err.message
            : '削除に失敗しました。';
      setError(msg);
      setBusy(false);
    }
  };

  const loading = refs === null && refsError === null;

  return (
    <Modal title="スペックを削除" onClose={onClose}>
      <div className="sb-form">
        <p style={{ margin: 0 }}>
          スペック <span className="sb-id-badge">{specId}</span> を削除しますか?
        </p>

        {loading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            参照を確認中…
          </p>
        )}

        {refsError && (
          <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>
            参照の取得に失敗しました: {refsError}
          </p>
        )}

        {refs !== null && refs.length > 0 && (
          <div className="sb-delete-warning">
            <strong className="sb-delete-warning__title">
              このスペックは {refs.length} 件のスペックから参照されています。
              削除するとリンクが壊れます:
            </strong>
            <ul className="sb-delete-warning__list">
              {refs.map((r) => (
                <li key={r}>
                  <span className="sb-id-badge">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="sb-form__error">{error}</p>}

        <div className="sb-form__actions">
          <button type="button" className="sb-btn" onClick={onClose} disabled={busy}>
            キャンセル
          </button>
          <button
            type="button"
            className="sb-btn sb-btn--danger"
            onClick={() => void doDelete()}
            disabled={busy || loading}
          >
            {busy ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
