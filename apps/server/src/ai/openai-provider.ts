import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import type { FunctionTool, Response, ResponseInputItem } from 'openai/resources/responses/responses';
import { AgentProvider, AgentRunInput, MAX_AGENT_STEPS, ProviderConfig } from './ai-types';
import { toolJsonSchema } from './tool-json-schema';

const DEFAULT_MODEL = 'gpt-6-astra';

@Injectable()
export class OpenAiProvider implements AgentProvider {
  readonly id = 'openai' as const;

  defaults(): ProviderConfig {
    return {
      label: 'Codex (OpenAI)',
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: process.env.OPENAI_BASE_URL ?? '',
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    };
  }

  isConfigured(config: ProviderConfig): boolean {
    return Boolean(config.apiKey);
  }

  async testConnection(config: ProviderConfig): Promise<string> {
    await this.client(config).models.retrieve(config.model);
    return `连接成功，模型 ${config.model} 可用`;
  }

  private client(config: ProviderConfig): OpenAI {
    return new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl || undefined });
  }

  async run({ system, turns, tools, execute, emit, signal, config }: AgentRunInput): Promise<void> {
    const client = this.client(config);
    const toolParams: FunctionTool[] = tools.map((spec) => ({
      type: 'function',
      name: spec.name,
      description: spec.description,
      parameters: toolJsonSchema(spec),
      strict: false,
    }));
    const input: ResponseInputItem[] = turns.map((turn) => ({ role: turn.role, content: turn.content }));

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      const stream = await client.responses.create(
        { model: config.model, instructions: system, input, tools: toolParams, stream: true },
        { signal },
      );
      let response: Response | undefined;
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') emit({ type: 'text', delta: event.delta });
        else if (event.type === 'response.completed' || event.type === 'response.incomplete') response = event.response;
        else if (event.type === 'response.failed') throw new Error(event.response.error?.message ?? 'OpenAI 请求失败');
        else if (event.type === 'error') throw new Error(event.message);
      }
      if (!response) throw new Error('OpenAI 没有返回结果');

      input.push(...toResponseInputItems(response.output));
      const calls = response.output.filter((item) => item.type === 'function_call');
      if (calls.length === 0) return;

      for (const call of calls) {
        let args: unknown;
        try {
          args = JSON.parse(call.arguments);
        } catch {
          input.push({ type: 'function_call_output', call_id: call.call_id, output: 'Error: arguments were not valid JSON' });
          continue;
        }
        const outcome = await execute(call.call_id, call.name, args);
        input.push({ type: 'function_call_output', call_id: call.call_id, output: outcome.isError ? `Error: ${outcome.output}` : outcome.output });
      }
    }
    emit({ type: 'notice', message: `已达到单次最多 ${MAX_AGENT_STEPS} 步的上限。` });
  }
}
