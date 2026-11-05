import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { blockService } from '../services/block-service';
import { dailyNoteService } from '../services/daily-note-service';
import { pageService } from '../services/page-service';
import type { BlockRef, PageSummary } from '../types/models';
import { queryKeys } from './query-keys';

export const TEMPLATE_PREFIX = '模板/';

export interface AutocompleteSources {
  searchPages(q: string): Promise<PageSummary[]>;
  searchBlocks(q: string): Promise<BlockRef[]>;
  listTemplates(): Promise<string[]>;
  dateTitle(offsetDays: number): string;
  timeNow(): string;
}

export function useAutocompleteSources(): AutocompleteSources {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      searchPages: (q) =>
        queryClient.fetchQuery({ queryKey: queryKeys.pages(q, 8), queryFn: () => pageService.list(q || undefined, 8), staleTime: 5_000 }),
      searchBlocks: (q) =>
        queryClient.fetchQuery({ queryKey: queryKeys.blockSearch(q), queryFn: () => blockService.search(q, 10), staleTime: 5_000 }),
      listTemplates: async () => {
        const pages = await queryClient.fetchQuery({
          queryKey: queryKeys.pages(TEMPLATE_PREFIX, 50),
          queryFn: () => pageService.list(TEMPLATE_PREFIX, 50),
          staleTime: 5_000,
        });
        return pages.filter((p) => p.title.startsWith(TEMPLATE_PREFIX) && p.blockCount > 0).map((p) => p.title);
      },
      dateTitle: (offsetDays) => {
        const date = new Date();
        date.setDate(date.getDate() + offsetDays);
        return dailyNoteService.titleFor(date);
      },
      timeNow: () => new Date().toTimeString().slice(0, 5),
    }),
    [queryClient],
  );
}
