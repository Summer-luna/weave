import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../repositories/api-client';
import { trashRepository } from '../repositories/trash-repository';
import { historyStore } from '../services/history-store';
import { queryKeys } from './query-keys';

const TRASH_KEY = ['trash'] as const;

export function useTrashController() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: TRASH_KEY, queryFn: () => trashRepository.list() });

  const refreshNotes = async () => {
    historyStore.clear();
    await queryClient.invalidateQueries({ queryKey: TRASH_KEY });
    void queryClient.invalidateQueries({ queryKey: queryKeys.pageRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.pagesRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.referencesRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.blockRefRoot });
  };

  const guard = async <T,>(work: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string }> => {
    try {
      return { ok: true, value: await work() };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : '操作失败' };
    }
  };

  return {
    query,
    items: query.data ?? [],
    restore: async (id: string) => {
      const result = await guard(() => trashRepository.restore(id));
      await refreshNotes();
      return result;
    },
    remove: async (id: string) => {
      const result = await guard(() => trashRepository.remove(id));
      await queryClient.invalidateQueries({ queryKey: TRASH_KEY });
      return result;
    },
    clear: async () => {
      const result = await guard(() => trashRepository.clear());
      await queryClient.invalidateQueries({ queryKey: TRASH_KEY });
      return result;
    },
  };
}
