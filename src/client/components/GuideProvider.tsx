/**
 * Guide drawer state.
 *
 * Owns the single source of truth for the authoring-guide drawer:
 * - which category's `_guide.md` is currently active (set by the route page),
 * - whether the drawer is open (persisted to localStorage so it survives navigation),
 * - the fetched guide body, with live refresh on `_guide.md` fs events.
 *
 * The drawer UI (GuideDrawer) and the page-bar toggle (GuideToggleButton) are pure
 * consumers of this context — there is exactly one fetch regardless of how many
 * components read the state.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FsEvent } from '@shared/types';
import { fetchGuide, saveGuide } from '../api';
import { useSpecs } from './SpecsProvider';
import { READONLY } from '../env';

const OPEN_STORAGE_KEY = 'specifian.guideOpen';

/** Relative `_guide.md` path for a category ("" = root). */
function guidePath(category: string): string {
  return category ? `${category}/_guide.md` : '_guide.md';
}

function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

interface GuideContextValue {
  /** Active category ("" = root), or null when the current page has no guide context. */
  category: string | null;
  /** Register/clear the active category. Called by route pages. */
  setCategory: (category: string | null) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Raw `_guide.md` contents (front-matter included), or null when none exists. */
  raw: string | null;
  /** True once the first fetch for the active category has resolved. */
  loaded: boolean;
  /** Whether a guide affordance should be shown at all (guide exists, or it is editable). */
  available: boolean;
  /** Persist new guide contents (PUT /api/guide). */
  save: (content: string) => Promise<void>;
}

const GuideContext = createContext<GuideContextValue | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const { onFsEvent } = useSpecs();
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpenState] = useState<boolean>(() => readStoredOpen());
  const [raw, setRaw] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Ignore storage failures (private mode etc.)
    }
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  const load = useCallback(async (cat: string) => {
    try {
      const res = await fetchGuide(cat);
      setRaw(res.guide);
    } catch {
      // On fetch failure, treat as no guide.
      setRaw(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Fetch whenever the active category changes.
  useEffect(() => {
    if (category === null) {
      setRaw(null);
      setLoaded(false);
      return;
    }
    setLoaded(false);
    void load(category);
  }, [category, load]);

  // Live refresh when the active category's _guide.md changes externally.
  useEffect(() => {
    if (category === null) return;
    const target = guidePath(category);
    const unsub = onFsEvent((e: FsEvent) => {
      if (e.path === target) void load(category);
    });
    return unsub;
  }, [onFsEvent, category, load]);

  const save = useCallback(
    async (content: string) => {
      if (category === null) return;
      const res = await saveGuide(category, content);
      setRaw(res.guide);
    },
    [category],
  );

  const available = category !== null && loaded && (!READONLY || raw != null);

  const value = useMemo<GuideContextValue>(
    () => ({
      category,
      setCategory,
      open,
      setOpen,
      toggle,
      raw,
      loaded,
      available,
      save,
    }),
    [category, open, setOpen, toggle, raw, loaded, available, save],
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useGuide must be used within a GuideProvider');
  return ctx;
}

/** Register the active category for the guide drawer for the lifetime of a page. */
export function useRegisterGuideCategory(category: string): void {
  const { setCategory } = useGuide();
  useEffect(() => {
    setCategory(category);
    return () => setCategory(null);
  }, [category, setCategory]);
}
