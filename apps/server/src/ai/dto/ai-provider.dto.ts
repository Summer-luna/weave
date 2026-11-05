export class AiProviderDto {
  id: 'claude' | 'openai' | 'compatible';
  label: string;
  model: string;
  configured: boolean;
}
