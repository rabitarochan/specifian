/**
 * ホーム。ルートの `_.mdx` (`GET /api/specs/_`) があれば描画。
 * 404 ならウェルカム + カテゴリー一覧を表示する。
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SpecDetail } from '@shared/types';
import { fetchSpec, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { MdxRenderer } from '../components/MdxRenderer';

export function Home() {
  const { specs } = useSpecs();
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // ルート直下の _.mdx (category="", slug="_")
    fetchSpec('', '_')
      .then((d) => {
        if (!active) return;
        setDetail(d);
        setNotFound(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiHttpError && err.status === 404) {
          setNotFound(true);
          setDetail(null);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="sb-loading">読み込み中…</div>;

  if (detail && !notFound) {
    return (
      <article className="sb-content">
        <MdxRenderer
          content={detail.content}
          specs={specs}
          category={detail.meta.category}
          slug={detail.meta.slug}
        />
      </article>
    );
  }

  // ウェルカム + カテゴリー一覧
  const categories = [...new Set(specs.map((s) => s.category))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <article className="sb-content">
      <div className="sb-prose">
        <h1>specifian へようこそ</h1>
        <p>
          <code>specs/</code> 配下の MDX スペックを表示・編集できます。
          左のサイドバーからカテゴリーやスペックを選んでください。
        </p>
        {categories.length > 0 ? (
          <>
            <h2>カテゴリー</h2>
            <div className="sb-card-grid">
              {categories.map((cat) => (
                <Link key={cat} to={`/specs/${cat}`} className="sb-card">
                  <span className="sb-card__title">{cat}</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p>
            まだスペックがありません。サイドバーの「＋」から最初のカテゴリーを作成しましょう。
          </p>
        )}
      </div>
    </article>
  );
}
