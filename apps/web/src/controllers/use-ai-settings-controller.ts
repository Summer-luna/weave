import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../repositories/api-client';
import { aiSettingsRepository } from '../repositories/ai-settings-repository';
import type { AiProviderId, UpdateAiSettingInput } from '../types/models';

const SETTINGS_KEY = ['aiSettings'] as const;

export function useAiSettingsController() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => aiSettingsRepository.list() });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    await queryClient.invalidateQueries({ queryKey: ['aiProviders'] });
  };

  const save = async (provider: AiProviderId, changes: UpdateAiSettingInput): Promise<string | null> => {
    try {
      await aiSettingsRepository.update(provider, changes);
      await refresh();
      return null;
    } catch (error) {
      return error instanceof ApiError ? error.message : '保存失败';
    }
  };

  const test = async (provider: AiProviderId): Promise<{ ok: boolean; message: string }> => {
    try {
      return { ok: true, message: await aiSettingsRepository.test(provider) };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : '连接失败' };
    }
  };

  return { query, settings: query.data ?? [], save, test };
}
