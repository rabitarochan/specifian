/**
 * `/specs/*` splat ルートのディスパッチャー。
 * splat の末尾セグメントを slug 候補とし:
 *  1. GET /api/specs/<splat> が成功 → SpecPage
 *  2. 404 → カテゴリーとみなし CategoryIndexPage (<splat> 全体がカテゴリーパス)
 * specs から ID 一致を先に確認し、無駄なリクエストを避けつつ確実に判定する。
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSpecByPath, ApiHttpError } from '../api';
import { useSpecs } from '../components/SpecsProvider';
import { SpecPage } from './SpecPage';
import { CategoryIndexPage } from './CategoryIndexPage';

type Resolved =
  | { kind: 'spec'; category: string; slug: string; specId: string }
  | { kind: 'category'; category: string }
  | { kind: 'loading' };

/** splat "api/v1/users" -> { category: "api/v1", slug: "users" } */
function splitSplat(splat: string): { category: string; slug: string } {
  const idx = splat.lastIndexOf('/');
  if (idx < 0) return { category: '', slug: splat };
  return { category: splat.slice(0, idx), slug: splat.slice(idx + 1) };
}

export function SpecsRoute() {
  const params = useParams();
  const splat = (params['*'] ?? '').replace(/\/+$/, '');
  const { specs } = useSpecs();
  const [resolved, setResolved] = useState<Resolved>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    setResolved({ kind: 'loading' });

    if (!splat) {
      setResolved({ kind: 'category', category: '' });
      return;
    }

    const { category, slug } = splitSplat(splat);
    const candidateId = `${category}:${slug}`;

    // specs に一致があれば即スペック確定
    if (specs.some((s) => s.id === candidateId)) {
      setResolved({ kind: 'spec', category, slug, specId: candidateId });
      return;
    }

    // 実フェッチで判定 (specs キャッシュが古い場合に備える)
    fetchSpecByPath(splat)
      .then((d) => {
        if (!active) return;
        setResolved({
          kind: 'spec',
          category: d.meta.category,
          slug: d.meta.slug,
          specId: d.meta.id,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiHttpError && err.status === 404) {
          // カテゴリーとして扱う
          setResolved({ kind: 'category', category: splat });
        } else {
          // その他のエラーでもカテゴリー表示でフォールバック
          setResolved({ kind: 'category', category: splat });
        }
      });

    return () => {
      active = false;
    };
  }, [splat, specs]);

  if (resolved.kind === 'loading') {
    return <div className="sb-loading">読み込み中…</div>;
  }
  if (resolved.kind === 'spec') {
    return (
      <SpecPage
        key={resolved.specId}
        category={resolved.category}
        slug={resolved.slug}
        specId={resolved.specId}
      />
    );
  }
  return <CategoryIndexPage key={resolved.category} category={resolved.category} />;
}
