import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pageService } from '../services/page-service';
import { saveQueue } from '../services/save-queue';
import { queryKeys } from './query-keys';

export function usePageListController(q = '', limit = 500) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.pages(q, limit),
    queryFn: () => pageService.list(q || undefined, limit),
    placeholderData: (previous) => previous,
  });

  const deletePage = (id: string, title: string) =>
    saveQueue.run(async () => {
      await pageService.delete(id);
      queryClient.removeQueries({ queryKey: queryKeys.page(title) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.pagesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.referencesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pageRoot });
    });

  return { query, deletePage };
}
