import { useMemo } from 'react';
import { aiToolDescriber } from '../services/ai-tool-describer';
import { attachmentService } from '../services/attachment-service';
import { contentTokenizer, TokenizedContent } from '../services/content-tokenizer';
import { dailyNoteService } from '../services/daily-note-service';
import { markdownBlockParser, ParsedContent } from '../services/markdown-block-parser';

export function useTokenizedContent(content: string): TokenizedContent {
  return useMemo(() => contentTokenizer.tokenize(content), [content]);
}

export function useParsedContent(content: string): ParsedContent {
  return useMemo(() => markdownBlockParser.parse(content), [content]);
}

export function toPlainText(content: string): string {
  return contentTokenizer.plainText(content);
}

export function nextTodoContent(content: string): string {
  return contentTokenizer.toggleTodo(content);
}

export function describeDailyTitle(title: string): string | null {
  return dailyNoteService.describe(title);
}

export function describeToolStep(name: string, input: unknown): string {
  return aiToolDescriber.describe(name, input);
}

export function uploadFiles(files: File[]): Promise<string> {
  return attachmentService.uploadAll(files);
}
