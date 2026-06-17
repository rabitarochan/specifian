/**
 * Full-text search command palette.
 * - Ctrl+K / Cmd+K globally toggles (preventDefault); Esc closes
 * - Input triggers incremental search via searchSpecs with a 150ms debounce
 * - ↑↓ to navigate (wraps), Enter to navigate to the spec, mouse hover/click also work
 *
 * Open/close state is shared via SearchPaletteProvider context so both the
 * sidebar search button and the global hotkey can open it.
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
import { cn } from '@/lib/utils';

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

  // Open globally with Ctrl+K / Cmd+K
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

  // Run search when the debounced query changes
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

  // Auto-focus on mount
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
    /* Backdrop: fixed full-screen overlay, items-start + pt-[12vh] centres palette near top */
    <div
      className="fixed inset-0 bg-foreground/45 flex items-start justify-center z-[950] px-5 pt-[12vh] pb-5"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-[10px] w-full max-w-[560px] shadow-[0_16px_48px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col max-h-[70vh]"
        role="dialog"
        aria-modal="true"
        aria-label="Search specs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input — large, borderless except bottom border */}
        <input
          ref={inputRef}
          className="w-full text-base px-[18px] py-4 border-0 border-b border-border outline-none bg-background text-foreground placeholder:text-muted-foreground"
          type="text"
          value={query}
          placeholder="Search specs…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search keyword"
        />
        {/* Results list */}
        <div className="overflow-y-auto p-1.5" role="listbox">
          {query.trim() === '' ? (
            <div className="px-[18px] py-[18px] text-muted-foreground text-[13.5px]">Search specs…</div>
          ) : results.length === 0 ? (
            <div className="px-[18px] py-[18px] text-muted-foreground text-[13.5px]">No matching specs</div>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.id}:${r.field}`}
                role="option"
                aria-selected={i === selected}
                className={cn(
                  'px-3 py-2 rounded-md cursor-pointer',
                  i === selected && 'bg-accent',
                )}
                onMouseEnter={() => setSelected(i)}
                onClick={() => go(r)}
              >
                <div className="flex items-baseline gap-2">
                  <span className={cn('font-bold text-foreground', i === selected && 'text-primary')}>
                    {r.title}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground bg-muted border border-border rounded px-[5px] py-px flex-shrink-0">
                    {r.category}·{r.field}
                  </span>
                </div>
                <div className="text-[12.5px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap mt-0.5">
                  {r.snippet}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
