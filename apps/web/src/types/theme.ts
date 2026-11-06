export type ThemeId = 'paper' | 'roam' | 'things-light' | 'things-dark' | 'system';

export type ResolvedTheme = Exclude<ThemeId, 'system'>;
