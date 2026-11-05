import { Injectable } from '@nestjs/common';
import { escapeRegExp } from '../common/text-patterns';

const TAG_SAFE = /^[\p{L}\p{N}_\-/]+$/u;

@Injectable()
export class LinkRewriter {
  renamePage(content: string, oldTitle: string, newTitle: string): string {
    const escaped = escapeRegExp(oldTitle);
    return content
      .replace(new RegExp(`\\[\\[${escaped}\\]\\]`, 'giu'), () => `[[${newTitle}]]`)
      .replace(new RegExp(`(^|[\\s(（：，、；])#${escaped}(?![\\p{L}\\p{N}_\\-/])`, 'giu'), (_match, prefix: string) =>
        TAG_SAFE.test(newTitle) ? `${prefix}#${newTitle}` : `${prefix}#[[${newTitle}]]`,
      );
  }

  linkMention(content: string, title: string): string {
    const index = content.toLowerCase().indexOf(title.toLowerCase());
    if (index < 0) return content;
    return `${content.slice(0, index)}[[${content.slice(index, index + title.length)}]]${content.slice(index + title.length)}`;
  }
}
