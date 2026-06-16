/**
 * Shared store for front-matter schema validation results.
 * - Fetches /api/validation on mount and re-fetches on each fs event
 * - Provides results grouped by specId via issuesBySpecId
 * - On fetch failure, keeps the previous value without crashing the app
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
import type { ValidationIssue } from '@shared/types';
import { fetchValidation } from '../api';
import { useSpecs } from './SpecsProvider';

interface ValidationContextValue {
  issuesBySpecId: Record<string, ValidationIssue[]>;
  allIssues: ValidationIssue[];
}

const ValidationContext = createContext<ValidationContextValue | null>(null);

export function useValidation(): ValidationContextValue {
  const ctx = useContext(ValidationContext);
  if (!ctx) {
    throw new Error('useValidation must be used within ValidationProvider');
  }
  return ctx;
}

export function ValidationProvider({ children }: { children: ReactNode }) {
  const { onFsEvent } = useSpecs();
  const [allIssues, setAllIssues] = useState<ValidationIssue[]>([]);

  const refetch = useCallback(async () => {
    try {
      const report = await fetchValidation();
      setAllIssues(report.issues);
    } catch {
      // On fetch failure, keep the previous value
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Re-validate on each fs event
  useEffect(() => {
    const unsub = onFsEvent(() => {
      void refetch();
    });
    return unsub;
  }, [onFsEvent, refetch]);

  const issuesBySpecId = useMemo(() => {
    const map: Record<string, ValidationIssue[]> = {};
    for (const issue of allIssues) {
      (map[issue.specId] ??= []).push(issue);
    }
    return map;
  }, [allIssues]);

  const value = useMemo(
    () => ({ issuesBySpecId, allIssues }),
    [issuesBySpecId, allIssues],
  );

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
}
