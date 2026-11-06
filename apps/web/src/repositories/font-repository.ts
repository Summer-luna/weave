import type { FontSettings } from '../types/font';

const STORAGE_KEY = 'weave.fonts';

export class FontRepository {
  load(): Record<string, unknown> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  save(settings: FontSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

export const fontRepository = new FontRepository();
