import type { ThemeId } from '../types/theme';

const STORAGE_KEY = 'weave.theme';
const THEMES: ThemeId[] = ['paper', 'roam', 'things-light', 'things-dark', 'system'];

export class ThemeRepository {
  load(): ThemeId | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      return raw && THEMES.includes(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  save(theme: ThemeId): void {
    localStorage.setItem(STORAGE_KEY, theme);
  }
}

export const themeRepository = new ThemeRepository();
