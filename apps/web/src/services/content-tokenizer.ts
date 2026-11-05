export type Token =
  | { type: 'text'; text: string }
  | { type: 'pageLink'; title: string }
  | { type: 'tag'; title: string }
  | { type: 'blockRef'; id: string }
  | { type: 'bold'; children: Token[] }
  | { type: 'italic'; children: Token[] }
  | { type: 'highlight'; children: Token[] }
  | { type: 'code'; text: string }
  | { type: 'url'; href: string }
  | { type: 'image'; alt: string; src: string }
  | { type: 'link'; text: string; href: string }
  | { type: 'lineBreak' };

export interface TokenizedContent {
  todo: 'open' | 'done' | null;
  tokens: Token[];
}

const TODO_PREFIX = /^\[( |x|X)\] /;
const INLINE =
  /(`[^`\n]+`)|!\[([^\]\n]*)\]\(((?:https?:\/\/|\/)[^)\s]+)\)|\[([^[\]\n]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)|#\[\[([^[\]]+)\]\]|\[\[([^[\]]+)\]\]|\(\(([A-Za-z0-9_-]{6,24})\)\)|\*\*(.+?)\*\*|__(.+?)__|\^\^(.+?)\^\^|(https?:\/\/[^\s<>()]+)|(?<=^|[\s(（：，、；])#([\p{L}\p{N}_\-/]+)|(\n)/gu;
export const TAG_SAFE_TITLE = /^[\p{L}\p{N}_\-/]+$/u;

export class ContentTokenizer {
  tokenize(content: string): TokenizedContent {
    const todoMatch = TODO_PREFIX.exec(content);
    const todo = todoMatch ? (todoMatch[1] === ' ' ? 'open' : 'done') : null;
    return { todo, tokens: this.inline(todoMatch ? content.slice(todoMatch[0].length) : content) };
  }

  plainText(content: string): string {
    return this.flatten(this.tokenize(content).tokens);
  }

  toggleTodo(content: string): string {
    const match = TODO_PREFIX.exec(content);
    if (!match) return `[ ] ${content}`;
    if (match[1] === ' ') return `[x] ${content.slice(match[0].length)}`;
    return content.slice(match[0].length);
  }

  private inline(text: string): Token[] {
    const tokens: Token[] = [];
    let last = 0;
    for (const match of text.matchAll(INLINE)) {
      const start = match.index ?? 0;
      if (start > last) tokens.push({ type: 'text', text: text.slice(last, start) });
      last = start + match[0].length;
      const [, code, imageAlt, imageSrc, linkText, linkHref, bracketTag, link, ref, bold, italic, highlight, url, tag] = match;
      if (code) tokens.push({ type: 'code', text: code.slice(1, -1) });
      else if (imageSrc) tokens.push({ type: 'image', alt: imageAlt ?? '', src: imageSrc });
      else if (linkHref) tokens.push({ type: 'link', text: linkText, href: linkHref });
      else if (bracketTag) tokens.push({ type: 'tag', title: bracketTag });
      else if (link) tokens.push({ type: 'pageLink', title: link });
      else if (ref) tokens.push({ type: 'blockRef', id: ref });
      else if (bold) tokens.push({ type: 'bold', children: this.inline(bold) });
      else if (italic) tokens.push({ type: 'italic', children: this.inline(italic) });
      else if (highlight) tokens.push({ type: 'highlight', children: this.inline(highlight) });
      else if (url) tokens.push({ type: 'url', href: url });
      else if (tag) tokens.push({ type: 'tag', title: tag });
      else tokens.push({ type: 'lineBreak' });
    }
    if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
    return tokens;
  }

  private flatten(tokens: Token[]): string {
    return tokens
      .map((token) => {
        switch (token.type) {
          case 'text':
            return token.text;
          case 'pageLink':
            return token.title;
          case 'tag':
            return `#${token.title}`;
          case 'blockRef':
            return '((…))';
          case 'code':
            return token.text;
          case 'url':
            return token.href;
          case 'image':
            return `[图片${token.alt ? `：${token.alt}` : ''}]`;
          case 'link':
            return token.text;
          case 'lineBreak':
            return ' ';
          default:
            return this.flatten(token.children);
        }
      })
      .join('');
  }
}

export const contentTokenizer = new ContentTokenizer();
