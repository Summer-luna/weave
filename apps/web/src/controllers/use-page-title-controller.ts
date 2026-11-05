import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ApiError } from '../repositories/api-client';
import { pageService } from '../services/page-service';
import { saveQueue } from '../services/save-queue';
import type { PageState } from '../types/models';
import { queryKeys } from './query-keys';

export function usePageTitleController(state: PageState | undefined) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rename = async (raw: string): Promise<boolean> => {
    setError(null);
    const title = raw.replace(/\s+/g, ' ').trim();
    if (!state || !title || title === state.title) return false;
    if (!state.pageId) {
      await navigate({ to: '/page/$title', params: { title } });
      return true;
    }
    setBusy(true);
    try {
      saveQueue.flushAll();
      const page = await pageService.rename(state.pageId, title);
      queryClient.removeQueries({ queryKey: queryKeys.page(state.title) });
      queryClient.setQueryData<PageState>(queryKeys.page(page.title), { ...state, title: page.title });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pageRoot,
        predicate: (q) => q.queryKey[1] !== pageService.titleKey(page.title),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pagesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.referencesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.blockRefRoot });
      await navigate({ to: '/page/$title', params: { title: page.title }, replace: true });
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '重命名失败');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { rename, error, busy, clearError: () => setError(null) };
}
