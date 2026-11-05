import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { uid } from '../common/uid';
import { AgentProvider, AgentRunInput, MAX_AGENT_STEPS, ProviderConfig } from './ai-types';
import { toolJsonSchema } from './tool-json-schema';

interface PendingCall {
  id: string;
  name: string;
  args: string;
}

// Third-party gateways that speak the OpenAI protocol mostly implement Chat Completions, not the Responses API.
@Injectable()
export class CompatibleProvider implements AgentProvider {
  readonly id = 'compatible' as const;

  defaults(): ProviderConfig {
    return {
      label: process.env.COMPAT_NAME || 'OpenAI 兼容接口',
      apiKey: process.env.COMPAT_API_KEY ?? '',
      baseUrl: process.env.COMPAT_BASE_URL ?? '',
      model: process.env.COMPAT_MODEL ?? '',
    };
  }

  isConfigured(config: ProviderConfig): boolean {
    return Boolean(config.baseUrl && config.apiKey && config.model);
  }

  async testConnection(config: ProviderConfig): Promise<string> {
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    // Many gateways don't implement /models, so a one-token completion is the reliable probe.
    await client.chat.completions.create({ model: config.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 });
    return `连接成功，模型 ${config.model} 可用`;
  }

  async run({ system, turns, tools, execute, emit, signal, config }: AgentRunInput): Promise<void> {
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    const toolParams: ChatCompletionTool[] = tools.map((spec) => ({
      type: 'function',
      function: { name: spec.name, description: spec.description, parameters: toolJsonSchema(spec) },
    }));
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...turns.map((turn): ChatCompletionMessageParam => ({ role: turn.role, content: turn.content })),
    ];

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      const stream = await client.chat.completions.create({ model: config.model, messages, tools: toolParams, stream: true }, { signal });
      let content = '';
      const calls: PendingCall[] = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          content += delta.content;
          emit({ type: 'text', delta: delta.content });
        }
        for (const call of delta.tool_calls ?? []) {
          const slot = (calls[call.index] ??= { id: '', name: '', args: '' });
          if (call.id) slot.id = call.id;
          if (call.function?.name) slot.name += call.function.name;
          if (call.function?.arguments) slot.args += call.function.arguments;
        }
      }
      const pending = calls.filter(Boolean).map((call) => ({ ...call, id: call.id || `call_${uid()}` }));
      if (pending.length === 0) return;

      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: pending.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.args || '{}' } })),
      });
      for (const call of pending) {
        let args: unknown;
        try {
          args = JSON.parse(call.args || '{}');
        } catch {
          messages.push({ role: 'tool', tool_call_id: call.id, content: 'Error: arguments were not valid JSON' });
          continue;
        }
        const outcome = await execute(call.id, call.name, args);
        messages.push({ role: 'tool', tool_call_id: call.id, content: outcome.isError ? `Error: ${outcome.output}` : outcome.output });
      }
    }
    emit({ type: 'notice', message: `已达到单次最多 ${MAX_AGENT_STEPS} 步的上限。` });
  }
}
