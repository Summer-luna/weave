import { describe, expect, it } from 'vitest';
import { LinkParser } from '../src/links/link-parser';
import { LinkRewriter } from '../src/links/link-rewriter';

const parser = new LinkParser();
const rewriter = new LinkRewriter();

describe('LinkParser', () => {
  it('extracts page links, tags and block refs', () => {
    const parsed = parser.parse('读了 [[深度工作]] 和 #[[时间 管理]]，见 ((abcdef123)) #reading #读书');
    expect(parsed.pageTitles).toEqual(['深度工作', '时间 管理', 'reading', '读书']);
    expect(parsed.blockRefs).toEqual(['abcdef123']);
  });

  it('recognises tags right after CJK punctuation', () => {
    expect(parser.parse('标签：#读书 #效率，#专注').pageTitles).toEqual(['读书', '效率', '专注']);
  });

  it('dedupes titles case-insensitively and ignores inline code', () => {
    const parsed = parser.parse('[[Rust]] [[rust]] `[[Hidden]]` a#notatag');
    expect(parsed.pageTitles).toEqual(['Rust']);
  });

  it('matches ASCII mentions on word boundaries only', () => {
    expect(parser.mentions('I love Rust a lot', 'rust')).toBe(true);
    expect(parser.mentions('Trusty tools', 'rust')).toBe(false);
    expect(parser.mentions('今天读了深度工作这本书', '深度工作')).toBe(true);
  });
});

describe('LinkRewriter', () => {
  it('rewrites links and tags when a page is renamed', () => {
    expect(rewriter.renamePage('see [[Old]] and #old, #[[Old]]', 'Old', 'New Name')).toBe(
      'see [[New Name]] and #[[New Name]], #[[New Name]]',
    );
    expect(rewriter.renamePage('#old #older', 'old', 'fresh')).toBe('#fresh #older');
  });

  it('wraps the first mention in a link', () => {
    expect(rewriter.linkMention('i like rust and Rust', 'Rust')).toBe('i like [[rust]] and Rust');
  });
});
