import type { AiProviderId, AiScope } from '../types/models';

const STORAGE_KEY = 'weave.ai.provider';
const SCOPE_KEY = 'weave.ai.scope';

export class AiPreferencesRepository {
  loadProvider(): AiProviderId | null {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'claude' || value === 'openai' || value === 'compatible' ? value : null;
  }

  loadScope(): AiScope {
    return localStorage.getItem(SCOPE_KEY) === 'library' ? 'library' : 'page';
  }

  saveScope(scope: AiScope): void {
    localStorage.setItem(SCOPE_KEY, scope);
  }

  saveProvider(provider: AiProviderId): void {
    localStorage.setItem(STORAGE_KEY, provider);
  }
}

export const aiPreferencesRepository = new AiPreferencesRepository();
