import { Injectable } from '@nestjs/common';
import { AppSettingsRepository } from '../storage/app-settings.repository';
import { AGENT_PERMISSION_LEVELS, AgentPermissionLevel, ToolSpec } from './ai-types';

const SETTING_KEY = 'agent.permission';
const DEFAULT_LEVEL: AgentPermissionLevel = 'edit';

@Injectable()
export class AgentPermissionService {
  constructor(private readonly settings: AppSettingsRepository) {}

  async get(): Promise<AgentPermissionLevel> {
    const saved = await this.settings.get(SETTING_KEY);
    return (AGENT_PERMISSION_LEVELS as readonly string[]).includes(saved ?? '') ? (saved as AgentPermissionLevel) : DEFAULT_LEVEL;
  }

  async set(level: AgentPermissionLevel): Promise<AgentPermissionLevel> {
    await this.settings.set(SETTING_KEY, level);
    return level;
  }

  allows(level: AgentPermissionLevel, spec: ToolSpec): boolean {
    if (spec.readOnly) return true;
    if (spec.destructive) return level === 'full';
    return level !== 'read';
  }
}
