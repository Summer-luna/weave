import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { dailyNoteService } from '../services/daily-note-service';
import { pageService } from '../services/page-service';
import { queryKeys } from './query-keys';

const PAGE_SIZE = 5;

export function useDailyNotesController() {
  const today = dailyNoteService.today();
  const [count, setCount] = useState(PAGE_SIZE);
  const pages = useQuery({ queryKey: queryKeys.pages('', 1000), queryFn: () => pageService.list(undefined, 1000) });
  const earlier = useMemo(
    () =>
      (pages.data ?? [])
        .filter((p) => p.blockCount > 0 && dailyNoteService.isDailyTitle(p.title) && p.title < today)
        .map((p) => p.title)
        .sort()
        .reverse(),
    [pages.data, today],
  );
  const titles = [today, ...earlier.slice(0, count - 1)];
  const hasMore = earlier.length > count - 1;
  return { titles, hasMore, loadMore: () => setCount((n) => n + PAGE_SIZE) };
}
