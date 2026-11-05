import type { AiProviderId, AiSetting, UpdateAiSettingInput } from '../types/models';
import { apiClient, unwrap } from './api-client';

export class AiSettingsRepository {
  list(): Promise<AiSetting[]> {
    return unwrap(apiClient.GET('/api/ai/settings'));
  }

  update(provider: AiProviderId, changes: UpdateAiSettingInput): Promise<AiSetting> {
    return unwrap(apiClient.PUT('/api/ai/settings/{provider}', { params: { path: { provider } }, body: changes }));
  }

  async test(provider: AiProviderId): Promise<string> {
    const result = await unwrap(apiClient.POST('/api/ai/settings/{provider}/test', { params: { path: { provider } } }));
    return result.message;
  }
}

export const aiSettingsRepository = new AiSettingsRepository();
