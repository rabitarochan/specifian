/**
 * カテゴリーインデックス。
 * `<category>/_.mdx` があれば描画、なければ自動生成の SpecList を表示する。
 * ヘッダーのボタンからインデックスの編集 (無ければ作成して編集) ができる。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpecDetail } from '@shared/types';
import { fetchSpec, createSpec, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { useToast } from '../components/Toast';
import { MdxRenderer } from '../components/MdxRenderer';
import { MdxProvider } from '../mdx/MdxContext';
import { SpecList } from '../components/mdx/SpecList';

export function CategoryIndexPage({ category }: { category: string }) {
  const { specs, refetch } = useSpecs();
  const navigate = useNavigate();
  const { show } = useToast();
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  /** /specs/<category>/_ のルート ("" カテゴリー = ルートインデックス) */
  const indexRoute = category ? `/specs/${category}/_` : '/specs/_';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetail(null);
    fetchSpec(category, '_')
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((err: unknown) => {
        // 404 は許容 (自動一覧へフォールバック)。それ以外も一覧表示で代替
        if (!(err instanceof ApiHttpError)) {
          // ネットワーク等。ログのみ
          console.error(err);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category]);

  /** _.mdx が無いカテゴリーで、デフォルトのインデックスを作成して編集へ */
  const createAndEdit = async () => {
    setCreating(true);
    try {
      await createSpec({ category, slug: '_', title: category || 'ホーム' });
      await refetch();
      navigate(`${indexRoute}?edit=1`);
    } catch (err) {
      show(
        err instanceof Error
          ? `インデックスの作成に失敗しました: ${err.message}`
          : 'インデックスの作成に失敗しました',
      );
      setCreating(false);
    }
  };

  if (loading) return <div className="sb-loading">読み込み中…</div>;

  if (detail) {
    return (
      <article className="sb-content">
        <header className="sb-page-bar">
          <h1 className="sb-page-bar__title">{detail.meta.title}</h1>
          <div className="sb-page-bar__actions">
            <button
              className="sb-btn"
              onClick={() => navigate(`${indexRoute}?edit=1`)}
            >
              インデックスを編集
            </button>
          </div>
        </header>
        <MdxRenderer
          content={detail.content}
          specs={specs}
          category={category}
          slug="_"
        />
      </article>
    );
  }

  // 自動生成の一覧
  return (
    <article className="sb-content">
      <header className="sb-page-bar">
        <h1 className="sb-page-bar__title">{category}</h1>
        <div className="sb-page-bar__actions">
          <button className="sb-btn" onClick={createAndEdit} disabled={creating}>
            {creating ? '作成中…' : 'インデックスを作成'}
          </button>
        </div>
      </header>
      <div className="sb-prose">
        <MdxProvider value={{ specs, category }}>
          <SpecList category={category} />
        </MdxProvider>
      </div>
    </article>
  );
}
