import { ContentTokenizer, contentTokenizer, Token } from './content-tokenizer';

export type TaskState = 'open' | 'done';
export type CellAlign = 'left' | 'center' | 'right' | null;

export interface ListItem {
  depth: number;
  marker: string | null;
  task: TaskState | null;
  line: number;
  tokens: Token[];
}

export type MdBlock =
  | { type: 'paragraph'; tokens: Token[] }
  | { type: 'heading'; level: number; tokens: Token[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'quote'; blocks: MdBlock[] }
  | { type: 'list'; items: ListItem[] }
  | { type: 'hr' }
  | { type: 'table'; align: CellAlign[]; header: Token[][]; rows: Token[][][] };

export interface ParsedContent {
  todo: TaskState | null;
  blocks: MdBlock[];
}

const TODO_PREFIX = /^\[( |x|X)\] /;
const FENCE = /^[ \t]*(`{3,}|~{3,})[ \t]*([\w+#.-]*)[ \t]*$/;
const HEADING = /^(#{1,6})[ \t]+(.*)$/;
const HR = /^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^[ \t]*>[ \t]?(.*)$/;
const LIST_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const TASK = /^\[( |x|X)\][ \t]+/;
const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

export class MarkdownBlockParser {
  constructor(private readonly tokenizer: ContentTokenizer) {}

  parse(content: string): ParsedContent {
    const todoMatch = TODO_PREFIX.exec(content);
    const todo = todoMatch ? (todoMatch[1] === ' ' ? 'open' : 'done') : null;
    const body = todoMatch ? content.slice(todoMatch[0].length) : content;
    return { todo, blocks: this.blocks(body.split('\n'), 0) };
  }

  toggleTask(content: string, line: number): string {
    const lines = content.split('\n');
    const target = lines[line];
    if (target === undefined) return content;
    lines[line] = target.replace(/^((?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[( |x|X)\]/, (_all, prefix: string, state: string) => `${prefix}[${state === ' ' ? 'x' : ' '}]`);
    return lines.join('\n');
  }

  private blocks(lines: string[], lineOffset: number): MdBlock[] {
    const blocks: MdBlock[] = [];
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: 'paragraph', tokens: this.tokenizer.inline(paragraph.join('\n')) });
      paragraph = [];
    };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = FENCE.exec(line);
      if (fence) {
        flush();
        const code: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
        i++;
        blocks.push({ type: 'code', lang: fence[2], text: code.join('\n') });
        continue;
      }
      const heading = HEADING.exec(line);
      if (heading) {
        flush();
        blocks.push({ type: 'heading', level: heading[1].length, tokens: this.tokenizer.inline(heading[2]) });
        i++;
        continue;
      }
      if (HR.test(line)) {
        flush();
        blocks.push({ type: 'hr' });
        i++;
        continue;
      }
      if (QUOTE.test(line)) {
        flush();
        const quoted: string[] = [];
        const start = i;
        while (i < lines.length && QUOTE.test(lines[i])) quoted.push(QUOTE.exec(lines[i++])![1]);
        blocks.push({ type: 'quote', blocks: this.blocks(quoted, lineOffset + start) });
        continue;
      }
      if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && TABLE_SEPARATOR.test(lines[i + 1])) {
        flush();
        const header = this.cells(line);
        const align = this.cells(lines[i + 1]).map((cell): CellAlign => {
          const left = cell.startsWith(':');
          const right = cell.endsWith(':');
          return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
        });
        i += 2;
        const rows: Token[][][] = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(this.cells(lines[i++]).map((cell) => this.tokenizer.inline(cell)));
        blocks.push({ type: 'table', align, header: header.map((cell) => this.tokenizer.inline(cell)), rows });
        continue;
      }
      if (LIST_ITEM.test(line)) {
        flush();
        const items: ListItem[] = [];
        while (i < lines.length && LIST_ITEM.test(lines[i])) {
          const [, indent, bullet, rest] = LIST_ITEM.exec(lines[i])!;
          const task = TASK.exec(rest);
          items.push({
            depth: Math.floor(indent.replace(/\t/g, '  ').length / 2),
            marker: /\d/.test(bullet) ? bullet.replace(')', '.') : null,
            task: task ? (task[1] === ' ' ? 'open' : 'done') : null,
            line: lineOffset + i,
            tokens: this.tokenizer.inline(task ? rest.slice(task[0].length) : rest),
          });
          i++;
        }
        blocks.push({ type: 'list', items });
        continue;
      }
      paragraph.push(line);
      i++;
    }
    flush();
    return blocks;
  }

  private cells(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map((cell) => cell.trim());
  }
}

export const markdownBlockParser = new MarkdownBlockParser(contentTokenizer);
