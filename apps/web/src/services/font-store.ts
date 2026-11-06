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
    dataset.fontLatin = this.settings.latin;
    dataset.fontCjk = this.settings.cjk;
    dataset.fontCode = this.settings.code;
  }

  private sanitize(saved: Partial<FontSettings>): FontSettings {
    return {
      latin: saved.latin && LATIN.includes(saved.latin) ? saved.latin : 'theme',
      cjk: saved.cjk && CJK.includes(saved.cjk) ? saved.cjk : 'theme',
      code: saved.code && CODE.includes(saved.code) ? saved.code : 'system',
    };
  }
}

export const fontStore = new FontStore();
