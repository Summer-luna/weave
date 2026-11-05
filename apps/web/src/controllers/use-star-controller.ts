import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pageService } from '../services/page-service';
import { saveQueue } from '../services/save-queue';
import type { PageState } from '../types/models';
import { queryKeys } from './query-keys';

export function useStarredPages() {
  return useQuery({ queryKey: [...queryKeys.pagesRoot, 'starred'], queryFn: () => pageService.starred() });
}

export function useStarController(state: PageState | undefined) {
  const queryClient = useQueryClient();

  const toggle = () =>
    saveQueue.run(async () => {
      if (!state) return;
      const pageId = state.pageId ?? (await pageService.ensure(state.title)).id;
      const page = await pageService.setStarred(pageId, !state.starred);
      queryClient.setQueryData<PageState>(queryKeys.page(state.title), (prev) =>
        prev ? { ...prev, pageId: page.id, starred: page.starred } : prev,
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.pagesRoot });
    });

  return { starred: state?.starred ?? false, toggle };
}
