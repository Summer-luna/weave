export class AiSettingDto {
  provider: 'claude' | 'openai' | 'compatible';
  label: string;
  baseUrl: string;
  model: string;
  defaultLabel: string;
  defaultBaseUrl: string;
  defaultModel: string;
  keySource: 'settings' | 'env' | 'none';
  keyPreview: string;
  effectiveLabel: string;
  effectiveModel: string;
  configured: boolean;
}
