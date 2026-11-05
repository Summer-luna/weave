import { BadRequestException, Injectable } from '@nestjs/common';
import { AiSettingsRepository } from '../storage/ai-settings.repository';
import { AgentProvider, AiProviderId, ProviderConfig } from './ai-types';
import { ClaudeProvider } from './claude-provider';
import { CompatibleProvider } from './compatible-provider';
import { AiSettingDto } from './dto/ai-setting.dto';
import { UpdateAiSettingDto } from './dto/update-ai-setting.dto';
import { OpenAiProvider } from './openai-provider';

type Field = 'label' | 'baseUrl' | 'apiKey' | 'model';

@Injectable()
export class AiSettingsService {
  readonly providers: AgentProvider[];

  constructor(
    private readonly settings: AiSettingsRepository,
    claude: ClaudeProvider,
    openai: OpenAiProvider,
    compatible: CompatibleProvider,
  ) {
    this.providers = [claude, openai, compatible];
  }

  provider(id: AiProviderId): AgentProvider {
    const provider = this.providers.find((p) => p.id === id);
    if (!provider) throw new BadRequestException('未知的 AI 提供方');
    return provider;
  }

  async resolve(id: AiProviderId): Promise<ProviderConfig> {
    const defaults = this.provider(id).defaults();
    const saved = await this.settings.find(id);
    const pick = (field: Field) => saved?.[field]?.trim() || defaults[field];
    return { label: pick('label'), baseUrl: pick('baseUrl'), apiKey: pick('apiKey'), model: pick('model') };
  }

  async list(): Promise<AiSettingDto[]> {
    return Promise.all(this.providers.map((p) => this.describe(p)));
  }

  async update(id: AiProviderId, changes: UpdateAiSettingDto): Promise<AiSettingDto> {
    const provider = this.provider(id);
    const saved = await this.settings.find(id);
    const next = {
      provider: id,
      label: changes.label ?? saved?.label ?? '',
      baseUrl: (changes.baseUrl ?? saved?.baseUrl ?? '').replace(/\/+$/, ''),
      model: changes.model ?? saved?.model ?? '',
      apiKey: changes.apiKey === undefined ? (saved?.apiKey ?? '') : changes.apiKey,
    };
    if (next.baseUrl && !/^https?:\/\//i.test(next.baseUrl)) throw new BadRequestException('Base URL 需要以 http:// 或 https:// 开头');
    await this.settings.upsert(next);
    return this.describe(provider);
  }

  async test(id: AiProviderId): Promise<string> {
    const provider = this.provider(id);
    const config = await this.resolve(id);
    if (!provider.isConfigured(config)) throw new BadRequestException('配置还不完整，请先填写 API Key（OpenAI 兼容接口还需要 Base URL 和模型）');
    try {
      return await provider.testConnection(config);
    } catch (error) {
      throw new BadRequestException(`连接失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async describe(provider: AgentProvider): Promise<AiSettingDto> {
    const saved = await this.settings.find(provider.id);
    const defaults = provider.defaults();
    const config = await this.resolve(provider.id);
    const savedKey = saved?.apiKey ?? '';
    return {
      provider: provider.id,
      label: saved?.label ?? '',
      baseUrl: saved?.baseUrl ?? '',
      model: saved?.model ?? '',
      defaultLabel: defaults.label,
      defaultBaseUrl: defaults.baseUrl,
      defaultModel: defaults.model,
      keySource: savedKey ? 'settings' : defaults.apiKey ? 'env' : 'none',
      keyPreview: this.mask(savedKey || defaults.apiKey),
      effectiveLabel: config.label,
      effectiveModel: config.model,
      configured: provider.isConfigured(config),
    };
  }

  private mask(key: string): string {
    if (!key) return '';
    return key.length <= 8 ? '••••' : `${key.slice(0, 3)}…${key.slice(-4)}`;
  }
}
