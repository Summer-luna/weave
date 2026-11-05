import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blockService } from '../services/block-service';
import { pageService } from '../services/page-service';
import { saveQueue } from '../services/save-queue';
import { queryKeys } from './query-keys';

export function useReferencesController(title: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.references(title),
    queryFn: () => pageService.references(title),
  });

  const linkMention = (blockId: string, sourcePageTitle: string) =>
    saveQueue.run(async () => {
      await blockService.linkMention(blockId, title);
      await queryClient.invalidateQueries({ queryKey: queryKeys.page(sourcePageTitle) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.referencesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pagesRoot });
    });

  return { query, linkMention };
}
