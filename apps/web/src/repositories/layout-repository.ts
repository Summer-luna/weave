import type { LayoutState } from '../types/models';

const STORAGE_KEY = 'weave.layout';

export class LayoutRepository {
  load(): LayoutState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LayoutState) : null;
    } catch {
      return null;
    }
  }

  save(state: LayoutState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export const layoutRepository = new LayoutRepository();
