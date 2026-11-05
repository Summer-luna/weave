import { useSyncExternalStore } from 'react';
import { layoutStore } from '../services/layout-store';
import type { SidebarItem } from '../types/models';

export function useLayoutController() {
  const state = useSyncExternalStore(
    (listener) => layoutStore.subscribe(listener),
    () => layoutStore.snapshot(),
  );
  return {
    ...state,
    itemKey: (item: SidebarItem) => layoutStore.itemKey(item),
    toggleLeft: () => layoutStore.toggleLeft(),
    toggleRight: () => layoutStore.toggleRight(),
    setAiOpen: (open: boolean) => layoutStore.setAiOpen(open),
    openInSidebar: (item: SidebarItem) => layoutStore.open(item),
    closeSidebarItem: (key: string) => layoutStore.close(key),
    closeAllSidebar: () => layoutStore.closeAll(),
  };
}
