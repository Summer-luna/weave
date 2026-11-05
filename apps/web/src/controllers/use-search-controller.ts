import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { blockService } from '../services/block-service';
import { pageService } from '../services/page-service';
import { queryKeys } from './query-keys';

export function useSearchController(input: string) {
  const [q, setQ] = useState(input.trim());

  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 150);
    return () => clearTimeout(timer);
  }, [input]);

  const pages = useQuery({
    queryKey: queryKeys.pages(q, 8),
    queryFn: () => pageService.list(q || undefined, 8),
    placeholderData: (previous) => previous,
  });
  const blocks = useQuery({
    queryKey: queryKeys.blockSearch(q),
    queryFn: () => blockService.search(q, 12),
    enabled: q.length > 0,
    placeholderData: (previous) => previous,
  });

  const exactMatch = (pages.data ?? []).some((p) => pageService.titleKey(p.title) === pageService.titleKey(q));

  return { q, pages: pages.data ?? [], blocks: q ? (blocks.data ?? []) : [], canCreate: q.length > 0 && !exactMatch };
}
