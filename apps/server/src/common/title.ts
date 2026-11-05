export const MAX_TITLE_LENGTH = 300;

export function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function titleKey(title: string): string {
  return normalizeTitle(title).toLowerCase();
}
