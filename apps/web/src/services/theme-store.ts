import { themeRepository } from '../repositories/theme-repository';
import type { ResolvedTheme, ThemeId } from '../types/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export class ThemeStore {
  private theme: ThemeId = themeRepository.load() ?? 'paper';
  private readonly listeners = new Set<() => void>();
  private readonly media = window.matchMedia(DARK_QUERY);

  constructor() {
    this.media.addEventListener('change', () => {
      if (this.theme === 'system') this.apply();
    });
  }

  snapshot(): ThemeId {
    return this.theme;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(theme: ThemeId): void {
    this.theme = theme;
    themeRepository.save(theme);
    this.apply();
    this.listeners.forEach((listener) => listener());
  }

  resolved(): ResolvedTheme {
    if (this.theme !== 'system') return this.theme;
    return this.media.matches ? 'things-dark' : 'things-light';
  }

  apply(): void {
    const root = document.documentElement;
    root.dataset.theme = this.resolved();
    const paper = getComputedStyle(root).getPropertyValue('--color-paper').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
  }
}

export const themeStore = new ThemeStore();
