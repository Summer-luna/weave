export type LatinFont = 'theme' | 'inter' | 'ia-quattro' | 'atkinson';

export type CjkFont = 'theme' | 'noto-sans-sc' | 'lxgw-wenkai';

export type CodeFont = 'system' | 'jetbrains-mono';

export interface FontSettings {
  uiLatin: LatinFont;
  uiCjk: CjkFont;
  noteLatin: LatinFont;
  noteCjk: CjkFont;
  code: CodeFont;
}
