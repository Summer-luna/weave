import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { AgentProvider, AgentRunInput, MAX_AGENT_STEPS, ProviderConfig } from './ai-types';
import { toolJsonSchema } from './tool-json-schema';

const DEFAULT_MODEL = 'claude-opus-5-5';
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);
const MAX_JSON_RETRIES = 2;

@Injectable()
export class ClaudeProvider implements AgentProvider {
  readonly id = 'claude' as const;

  defaults(): ProviderConfig {
    return {
      label: 'Claude',
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      baseUrl: process.env.ANTHROPIC_BASE_URL ?? '',
      model: process.env.CLAUDE_MODEL || DEFAULT_MODEL,
    };
  }

  isConfigured(config: ProviderConfig): boolean {
    return Boolean(config.apiKey || process.env.ANTHROPIC_AUTH_TOKEN);
  }

  async testConnection(config: ProviderConfig): Promise<string> {
    const page = await this.client(config).models.list({ limit: 20 });
    const ids = page.data.map((m) => m.id);
    return ids.includes(config.model) ? `连接成功，模型 ${config.model} 可用` : `连接成功（返回的模型列表里没看到 ${config.model}，请确认模型名）`;
  }

  private client(config: ProviderConfig): Anthropic {
    const baseURL = config.baseUrl || undefined;
    if (config.apiKey) return new Anthropic({ apiKey: config.apiKey, baseURL });
    return new Anthropic({ apiKey: null, authToken: process.env.ANTHROPIC_AUTH_TOKEN, baseURL });
  }

  async run({ system, turns, tools, execute, emit, signal, config }: AgentRunInput): Promise<void> {
    const client = this.client(config);
    const toolParams: Anthropic.Beta.BetaTool[] = tools.map((spec) => ({
      name: spec.name,
      description: spec.description,
      input_schema: toolJsonSchema(spec),
      eager_input_streaming: true,
    }));
    const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((turn) => ({ role: turn.role, content: turn.content }));
    // Third-party gateways (ANTHROPIC_BASE_URL) rarely support beta features such as server-side fallbacks.
    const useFallbacks = FALLBACK_MODELS.has(config.model) && !config.baseUrl;
    let jsonRetries = 0;

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      const stream = client.beta.messages.stream(
        {
          model: config.model,
          max_tokens: 64000,
          system,
          tools: toolParams,
          messages,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          cache_control: { type: 'ephemeral' },
          ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        },
        { signal },
      );
      stream.on('text', (delta) => emit({ type: 'text', delta }));

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (error) {
        if (error instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= MAX_JSON_RETRIES) throw error;
        continue;
      }

      if (message.stop_reason === 'refusal') {
        emit({ type: 'notice', message: 'Claude 拒绝了这个请求。' });
        return;
      }
      if (message.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: message.content });
        continue;
      }
      const toolUses = message.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use');
      if (toolUses.length === 0) return;
      if (message.stop_reason === 'max_tokens') throw new Error('回复超出长度上限，工具参数被截断');

      messages.push({ role: 'assistant', content: message.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const outcome = await execute(use.id, use.name, use.input);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: outcome.output, is_error: outcome.isError });
      }
      messages.push({ role: 'user', content: results });
    }
    emit({ type: 'notice', message: `已达到单次最多 ${MAX_AGENT_STEPS} 步的上限。` });
  }
}
