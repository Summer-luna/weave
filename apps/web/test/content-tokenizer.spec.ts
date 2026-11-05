import { describe, expect, it } from 'vitest';
import { ContentTokenizer } from '../src/services/content-tokenizer';

const tokenizer = new ContentTokenizer();

describe('ContentTokenizer', () => {
  it('tokenizes links, tags, refs and formatting', () => {
    const { tokens } = tokenizer.tokenize('读 [[深度工作]] #focus #[[长 标签]] ((abcdef123)) **重点** `code` https://x.dev/a');
    expect(tokens.filter((t) => t.type !== 'text')).toEqual([
      { type: 'pageLink', title: '深度工作' },
      { type: 'tag', title: 'focus' },
      { type: 'tag', title: '长 标签' },
      { type: 'blockRef', id: 'abcdef123' },
      { type: 'bold', children: [{ type: 'text', text: '重点' }] },
      { type: 'code', text: 'code' },
      { type: 'url', href: 'https://x.dev/a' },
    ]);
  });

  it('does not treat a hash inside a word as a tag', () => {
    const { tokens } = tokenizer.tokenize('C#sharp');
    expect(tokens).toEqual([{ type: 'text', text: 'C#sharp' }]);
  });

  it('cycles todo state', () => {
    expect(tokenizer.toggleTodo('buy milk')).toBe('[ ] buy milk');
    expect(tokenizer.toggleTodo('[ ] buy milk')).toBe('[x] buy milk');
    expect(tokenizer.toggleTodo('[x] buy milk')).toBe('buy milk');
    expect(tokenizer.tokenize('[x] done').todo).toBe('done');
  });

  it('produces plain text for breadcrumbs', () => {
    expect(tokenizer.plainText('见 [[页面]] 和 #tag')).toBe('见 页面 和 #tag');
  });

  it('parses images and links to uploaded files but not unsafe schemes', () => {
    const { tokens } = tokenizer.tokenize('图 ![截图](/api/files/abc123) 文件 [报告.pdf](/api/files/def456) [x](javascript:alert(1))');
    expect(tokens).toContainEqual({ type: 'image', alt: '截图', src: '/api/files/abc123' });
    expect(tokens).toContainEqual({ type: 'link', text: '报告.pdf', href: '/api/files/def456' });
    expect(tokens.some((t) => t.type === 'link' && t.href.startsWith('javascript'))).toBe(false);
  });
});
