import type { AgentPermissionLevel } from '../types/models';
import { apiClient, unwrap } from './api-client';

export class AgentPermissionRepository {
  async get(): Promise<AgentPermissionLevel> {
    return (await unwrap(apiClient.GET('/api/ai/permission'))).level;
  }

  async set(level: AgentPermissionLevel): Promise<AgentPermissionLevel> {
    return (await unwrap(apiClient.PUT('/api/ai/permission', { body: { level } }))).level;
  }
}

export const agentPermissionRepository = new AgentPermissionRepository();
