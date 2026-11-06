import { useSyncExternalStore } from 'react';
import { fontStore } from '../services/font-store';
import type { FontSettings } from '../types/font';

export function useFontController() {
  const fonts = useSyncExternalStore(
    (listener) => fontStore.subscribe(listener),
    () => fontStore.snapshot(),
  );
  return { fonts, change: (patch: Partial<FontSettings>) => fontStore.update(patch) };
}
