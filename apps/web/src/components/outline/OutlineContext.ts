import { createContext, useContext } from 'react';
import type { AutocompleteSources } from '../../controllers/use-autocomplete-sources';
import type { OutlineActions } from '../../controllers/use-outline-controller';
import type { OutlineViewStore } from './OutlineViewStore';

export interface OutlineContextValue {
  pageTitle: string;
  store: OutlineViewStore;
  actions: OutlineActions;
  sources: AutocompleteSources;
  dragging: { id: string | null; set(id: string | null): void };
}

export const OutlineContext = createContext<OutlineContextValue | null>(null);

export function useOutlineContext(): OutlineContextValue {
  const value = useContext(OutlineContext);
  if (!value) throw new Error('OutlineContext missing');
  return value;
}
