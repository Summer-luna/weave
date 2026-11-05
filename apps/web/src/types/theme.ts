export type ThemeId = 'paper' | 'things-light' | 'things-dark' | 'system';

export type ResolvedTheme = Exclude<ThemeId, 'system'>;
