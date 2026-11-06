import type { FontSettings } from '../types/font';

const STORAGE_KEY = 'weave.fonts';

export class FontRepository {
  load(): Partial<FontSettings> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Partial<FontSettings>) : null;
    } catch {
      return null;
    }
  }

  save(settings: FontSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

export const fontRepository = new FontRepository();
