/**
 * front-matter スキーマバリデーションの結果を保持する共有ストア。
 * - マウント時に /api/validation を取得し、fs イベントごとに再取得する
 * - issuesBySpecId で specId 別にグルーピングして提供する
 * - 取得失敗時はアプリを落とさず前回値を保持する
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
      // 取得失敗時は前回値を保持
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // fs イベントごとに再検証
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
