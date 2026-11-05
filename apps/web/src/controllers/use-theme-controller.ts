import { useSyncExternalStore } from 'react';
import { themeStore } from '../services/theme-store';
import type { ThemeId } from '../types/theme';

export function useThemeController() {
  const theme = useSyncExternalStore(
    (listener) => themeStore.subscribe(listener),
    () => themeStore.snapshot(),
  );
  return { theme, change: (next: ThemeId) => themeStore.set(next) };
}
