import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { dailyNoteService } from '../services/daily-note-service';
import { pageService } from '../services/page-service';
import { queryKeys } from './query-keys';

export function useCalendarController() {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const pages = useQuery({ queryKey: queryKeys.pages('', 1000), queryFn: () => pageService.list(undefined, 1000) });

  const notes = useMemo(() => {
    const map = new Map<string, number>();
    for (const page of pages.data ?? []) if (dailyNoteService.isDailyTitle(page.title) && page.blockCount > 0) map.set(page.title, page.blockCount);
    return map;
  }, [pages.data]);

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const date = new Date(year, month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

  return {
    ...cursor,
    weeks: dailyNoteService.monthGrid(cursor.year, cursor.month),
    today: dailyNoteService.today(),
    notes,
    previous: () => shift(-1),
    next: () => shift(1),
    goToday: () => setCursor({ year: now.getFullYear(), month: now.getMonth() }),
  };
}
