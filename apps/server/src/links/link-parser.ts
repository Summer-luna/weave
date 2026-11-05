import { Injectable } from '@nestjs/common';
import { escapeRegExp } from '../common/text-patterns';
import { normalizeTitle, titleKey } from '../common/title';

export interface ParsedLinks {
  pageTitles: string[];
  blockRefs: string[];
}

const PAGE_LINK = /\[\[([^[\]]+)\]\]/g;
const TAG = /(^|[\s(（：，、；])#([\p{L}\p{N}_\-/]+)/gu;
const BLOCK_REF = /\(\(([A-Za-z0-9_-]{6,24})\)\)/g;
const INLINE_CODE = /`[^`]*`/g;

@Injectable()
export class LinkParser {
  parse(content: string): ParsedLinks {
    const text = content.replace(INLINE_CODE, ' ');
    const titles = new Map<string, string>();
    const addTitle = (raw: string) => {
      const title = normalizeTitle(raw);
      if (title && !titles.has(titleKey(title))) titles.set(titleKey(title), title);
    };
    for (const match of text.matchAll(PAGE_LINK)) addTitle(match[1]);
    for (const match of text.matchAll(TAG)) addTitle(match[2]);
    const refs = new Set<string>();
    for (const match of text.matchAll(BLOCK_REF)) refs.add(match[1]);
    return { pageTitles: [...titles.values()], blockRefs: [...refs] };
  }

  mentions(content: string, title: string): boolean {
    const escaped = escapeRegExp(title);
    // CJK text has no word separators, so only ASCII titles get word-boundary matching.
    const pattern = /^[\x20-\x7e]+$/.test(title)
      ? new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu')
      : new RegExp(escaped, 'iu');
    return pattern.test(content);
  }
}
