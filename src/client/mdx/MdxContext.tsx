/**
 * 描画中の MDX へ specs / category を供給する React コンテキスト。
 * SpecList などの組み込みコンポーネントが MDX scope ではなくここから値を読む。
 */
import { createContext, useContext } from 'react';
import type { SpecMeta } from '@shared/types';

export interface MdxContextValue {
  specs: SpecMeta[];
  category: string;
}

const MdxContext = createContext<MdxContextValue>({ specs: [], category: '' });

export const MdxProvider = MdxContext.Provider;

export function useMdxContext(): MdxContextValue {
  return useContext(MdxContext);
}
