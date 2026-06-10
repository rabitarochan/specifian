/**
 * カテゴリーインデックス。
 * `<category>/_.mdx` があれば描画、なければ自動生成の SpecList を表示する。
 */
import { useEffect, useState } from 'react';
import type { SpecDetail } from '@shared/types';
import { fetchSpec, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { MdxRenderer } from '../components/MdxRenderer';
import { MdxProvider } from '../mdx/MdxContext';
import { SpecList } from '../components/mdx/SpecList';

export function CategoryIndexPage({ category }: { category: string }) {
  const { specs } = useSpecs();
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="sb-loading">読み込み中…</div>;

  if (detail) {
    return (
      <article className="sb-content">
        <header className="sb-page-bar">
          <h1 className="sb-page-bar__title">{detail.meta.title}</h1>
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
      </header>
      <div className="sb-prose">
        <MdxProvider value={{ specs, category }}>
          <SpecList category={category} />
        </MdxProvider>
      </div>
    </article>
  );
}
