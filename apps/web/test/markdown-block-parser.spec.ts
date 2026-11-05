import { describe, expect, it } from 'vitest';
import { ContentTokenizer } from '../src/services/content-tokenizer';
import { MarkdownBlockParser } from '../src/services/markdown-block-parser';

const tokenizer = new ContentTokenizer();
const parser = new MarkdownBlockParser(tokenizer);

describe('MarkdownBlockParser', () => {
  it('turns "# " prefixes into headings but keeps #tags', () => {
    expect(parser.parse('# 标题').blocks).toEqual([{ type: 'heading', level: 1, tokens: [{ type: 'text', text: '标题' }] }]);
    expect(parser.parse('### [[页面]]').blocks).toEqual([{ type: 'heading', level: 3, tokens: [{ type: 'pageLink', title: '页面' }] }]);
    expect(parser.parse('#tag 文字').blocks[0].type).toBe('paragraph');
  });

  it('keeps plain multi-line text as one paragraph', () => {
    const { blocks } = parser.parse('第一行\n第二行');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
  });

  it('parses code fences, quotes, rules, lists and tasks', () => {
    const { blocks } = parser.parse('```ts\nconst a = **1**;\n```\n> 引用 **粗**\n---\n- 一\n  - 二\n1. 三\n- [ ] 待办\n- [x] 完成');
    expect(blocks.map((b) => b.type)).toEqual(['code', 'quote', 'hr', 'list']);
    expect(blocks[0]).toEqual({ type: 'code', lang: 'ts', text: 'const a = **1**;' });
    const list = blocks[3];
    if (list.type !== 'list') throw new Error('expected list');
    expect(list.items.map((i) => [i.depth, i.marker, i.task, i.line])).toEqual([
      [0, null, null, 5],
      [1, null, null, 6],
      [0, '1.', null, 7],
      [0, null, 'open', 8],
      [0, null, 'done', 9],
    ]);
  });

  it('parses tables with alignment', () => {
    const { blocks } = parser.parse('| 名称 | 数量 |\n| :-- | --: |\n| 苹果 | 3 |');
    expect(blocks[0]).toMatchObject({ type: 'table', align: ['left', 'right'], rows: [[[{ type: 'text', text: '苹果' }], [{ type: 'text', text: '3' }]]] });
  });

  it('toggles a task line in place', () => {
    const content = '清单\n- [ ] 牛奶\n- [x] 面包';
    expect(parser.toggleTask(content, 1)).toBe('清单\n- [x] 牛奶\n- [x] 面包');
    expect(parser.toggleTask(content, 2)).toBe('清单\n- [ ] 牛奶\n- [ ] 面包');
    expect(parser.toggleTask(content, 0)).toBe(content);
  });
});

describe('inline Markdown', () => {
  it('supports *italic*, ~~strike~~ and ==highlight== without breaking links', () => {
    const { tokens } = tokenizer.tokenize('这是*斜体*和~~删除~~和==高亮== [[a*b*c]] 2 * 3 * 4');
    expect(tokens.filter((t) => t.type !== 'text')).toEqual([
      { type: 'italic', children: [{ type: 'text', text: '斜体' }] },
      { type: 'strike', children: [{ type: 'text', text: '删除' }] },
      { type: 'highlight', children: [{ type: 'text', text: '高亮' }] },
      { type: 'pageLink', title: 'a*b*c' },
    ]);
  });

  it('strips Markdown markers from plain text', () => {
    expect(tokenizer.plainText('## 标题 [[页]]')).toBe('标题 页');
    expect(tokenizer.plainText('- [ ] 买菜')).toBe('买菜');
  });
});
