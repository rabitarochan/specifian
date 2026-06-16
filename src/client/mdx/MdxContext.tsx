/**
 * React context that supplies specs / category to the MDX being rendered.
 * Built-in components such as SpecList read values from here rather than from MDX scope.
 */
import { createContext, useContext } from 'react';
import type { SpecMeta } from '@shared/types';

export interface MdxContextValue {
  specs: SpecMeta[];
  category: string;
  /**
   * Handler that processes wiki link clicks instead of normal navigation.
   * Specify this in contexts where the link target should be displayed in-place,
   * such as the graph preview pane.
   */
  onWikiNavigate?: (id: string) => void;
}

const MdxContext = createContext<MdxContextValue>({ specs: [], category: '' });

export const MdxProvider = MdxContext.Provider;

export function useMdxContext(): MdxContextValue {
  return useContext(MdxContext);
}
