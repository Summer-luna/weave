import { randomBytes } from 'node:crypto';

export const BLOCK_ID_PATTERN = /^[A-Za-z0-9_-]{6,24}$/;

export function uid(): string {
  return randomBytes(9).toString('base64url');
}
