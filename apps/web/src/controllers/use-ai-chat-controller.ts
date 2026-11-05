import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useEffect, useSyncExternalStore } from 'react';
import { aiRepository } from '../repositories/ai-repository';
import { AI_PRESETS, aiChatStore } from '../services/ai-chat-store';
import { dailyNoteService } from '../services/daily-note-service';
import { historyStore } from '../services/history-store';
import { layoutStore } from '../services/layout-store';
import type { AiProviderId, AiScope } from '../types/models';
import { queryKeys } from './query-keys';

const REFRESH_DELAY_MS = 300;

export function useCurrentPageTitle(): string {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const match = /^\/page\/(.+)$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : dailyNoteService.today();
}

export function useAiChatController() {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(
    (listener) => aiChatStore.subscribe(listener),
    () => aiChatStore.snapshot(),
  );
  const providers = useQuery({ queryKey: ['aiProviders'], queryFn: () => aiRepository.providers(), staleTime: 60_000 });
  const pageTitle = useCurrentPageTitle();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = aiChatStore.onMutated(() => {
      historyStore.clear();
      clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.pageRoot });
        void queryClient.invalidateQueries({ queryKey: queryKeys.referencesRoot });
        void queryClient.invalidateQueries({ queryKey: queryKeys.pagesRoot });
        void queryClient.invalidateQueries({ queryKey: queryKeys.blockRefRoot });
      }, REFRESH_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient]);

  const available = (providers.data ?? []).filter((p) => p.configured);
  const active = available.find((p) => p.id === state.provider) ?? available[0];

  return {
    ...state,
    pageTitle,
    providers: providers.data ?? [],
    providersLoading: providers.isPending,
    activeProvider: active,
    presets: AI_PRESETS,
    send: (text: string) => {
      if (active && active.id !== state.provider) aiChatStore.setProvider(active.id);
      return aiChatStore.send(text, pageTitle);
    },
    runPreset: (key: string) => {
      const preset = AI_PRESETS.find((p) => p.key === key);
      if (preset) void aiChatStore.send(preset.prompt(pageTitle), pageTitle, preset.scope);
    },
    setProvider: (id: AiProviderId) => aiChatStore.setProvider(id),
    setScope: (scope: AiScope) => aiChatStore.setScope(scope),
    confirm: (stepId: string, approved: boolean) => aiChatStore.confirm(stepId, approved),
    undoRun: (itemId: string) => aiChatStore.undoRun(itemId),
    stop: () => aiChatStore.stop(),
    clear: () => aiChatStore.clear(),
    close: () => layoutStore.setAiOpen(false),
  };
}

export function useAiPageActions() {
  return {
    organize: (pageTitle: string) => {
      layoutStore.setAiOpen(true);
      const preset = AI_PRESETS.find((p) => p.key === 'organize')!;
      void aiChatStore.send(preset.prompt(pageTitle), pageTitle, preset.scope);
    },
  };
}
