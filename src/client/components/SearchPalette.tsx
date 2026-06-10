/**
 * 全文検索コマンドパレット。
 * - Ctrl+K / Cmd+K でグローバルに開閉 (preventDefault)、Esc で閉じる
 * - 入力は 150ms デバウンスで searchSpecs を叩くインクリメンタル検索
 * - ↑↓ で選択 (ラップ)、Enter で該当スペックへ遷移、マウスホバー/クリックでも選択・遷移
 *
 * 開閉状態は SearchPaletteProvider のコンテキストで共有し、
 * サイドバーの検索ボタンとグローバルホットキーの双方から開けるようにする。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '@shared/types';
import { specRoute } from '@shared/types';
import { searchSpecs } from '../api';
import { useDebounced } from '../hooks/useDebounced';

interface SearchPaletteContextValue {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
}

const SearchPaletteContext = createContext<SearchPaletteContextValue | null>(null);

export function useSearchPalette(): SearchPaletteContextValue {
  const ctx = useContext(SearchPaletteContext);
  if (!ctx) {
    throw new Error('useSearchPalette must be used within SearchPaletteProvider');
  }
  return ctx;
}

export function SearchPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  // グローバル Ctrl+K / Cmd+K で開く
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SearchPaletteContext.Provider value={{ open, openPalette, closePalette }}>
      {children}
      {open && <SearchPalette onClose={closePalette} />}
    </SearchPaletteContext.Provider>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounced(query, 150);

  // 検索実行 (デバウンス済みクエリの変化で)
  useEffect(() => {
    let active = true;
    searchSpecs(debouncedQuery)
      .then((res) => {
        if (!active) return;
        setResults(res);
        setSelected(0);
      })
      .catch(() => {
        if (!active) return;
        setResults([]);
        setSelected(0);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  // マウント時にオートフォーカス
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const go = useCallback(
    (result: SearchResult) => {
      navigate(specRoute(result.id));
      onClose();
    },
    [navigate, onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) setSelected((i) => (i + 1) % results.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelected((i) => (i - 1 + results.length) % results.length);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const result = results[selected];
      if (result) go(result);
    }
  };

  return (
    <div className="sb-palette-backdrop" onClick={onClose}>
      <div
        className="sb-palette"
        role="dialog"
        aria-modal="true"
        aria-label="スペックを検索"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="sb-palette__input"
          type="text"
          value={query}
          placeholder="スペックを検索…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="検索キーワード"
        />
        <div className="sb-palette__results" role="listbox">
          {query.trim() === '' ? (
            <div className="sb-palette__hint">スペックを検索…</div>
          ) : results.length === 0 ? (
            <div className="sb-palette__hint">該当するスペックがありません</div>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.id}:${r.field}`}
                role="option"
                aria-selected={i === selected}
                className={
                  i === selected
                    ? 'sb-palette__row sb-palette__row--selected'
                    : 'sb-palette__row'
                }
                onMouseEnter={() => setSelected(i)}
                onClick={() => go(r)}
              >
                <div className="sb-palette__row-head">
                  <span className="sb-palette__row-title">{r.title}</span>
                  <span className="sb-palette__row-tag">
                    {r.category}·{r.field}
                  </span>
                </div>
                <div className="sb-palette__row-snippet">{r.snippet}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
