import { fontRepository } from '../repositories/font-repository';
import type { CjkFont, CodeFont, FontSettings, LatinFont } from '../types/font';

const LATIN: LatinFont[] = ['theme', 'inter', 'ia-quattro', 'atkinson'];
const CJK: CjkFont[] = ['theme', 'noto-sans-sc', 'lxgw-wenkai'];
const CODE: CodeFont[] = ['system', 'jetbrains-mono'];

export class FontStore {
  private settings: FontSettings = this.sanitize(fontRepository.load() ?? {});
  private readonly listeners = new Set<() => void>();

  snapshot(): FontSettings {
    return this.settings;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update(patch: Partial<FontSettings>): void {
    this.settings = { ...this.settings, ...patch };
    fontRepository.save(this.settings);
    this.apply();
    this.listeners.forEach((listener) => listener());
  }

  apply(): void {
    const { dataset } = document.documentElement;
    dataset.fontUiLatin = this.settings.uiLatin;
    dataset.fontUiCjk = this.settings.uiCjk;
    dataset.fontNoteLatin = this.settings.noteLatin;
    dataset.fontNoteCjk = this.settings.noteCjk;
    dataset.fontCode = this.settings.code;
  }

  private sanitize(saved: Record<string, unknown>): FontSettings {
    const latin = (value: unknown): LatinFont => (LATIN.includes(value as LatinFont) ? (value as LatinFont) : 'theme');
    const cjk = (value: unknown): CjkFont => (CJK.includes(value as CjkFont) ? (value as CjkFont) : 'theme');
    return {
      uiLatin: latin(saved.uiLatin ?? saved.latin),
      uiCjk: cjk(saved.uiCjk ?? saved.cjk),
      noteLatin: latin(saved.noteLatin ?? saved.latin),
      noteCjk: cjk(saved.noteCjk ?? saved.cjk),
      code: CODE.includes(saved.code as CodeFont) ? (saved.code as CodeFont) : 'system',
    };
  }
}

export const fontStore = new FontStore();
