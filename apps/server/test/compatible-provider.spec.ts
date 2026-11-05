import { createServer, IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AgentEvent } from '../src/ai/ai-types';
import { CompatibleProvider } from '../src/ai/compatible-provider';
import { NOTE_TOOL_SPECS } from '../src/ai/note-tool-specs';

let server: Server;
const requests: { messages: { role: string; content: unknown; tool_calls?: unknown[] }[]; tools: unknown[] }[] = [];

function chunk(delta: Record<string, unknown>) {
  return `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`;
}

async function readBody(req: IncomingMessage) {
  let body = '';
  for await (const part of req) body += part;
  return JSON.parse(body);
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const body = await readBody(req);
    requests.push(body);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if (requests.length === 1) {
      res.write(chunk({ role: 'assistant', content: '查一下。' }));
      res.write(chunk({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'search_pages', arguments: '{"que' } }] }));
      res.write(chunk({ tool_calls: [{ index: 0, function: { arguments: 'ry":"Deep"}' } }] }));
    } else {
      res.write(chunk({ content: '找到了。' }));
    }
    res.end('data: [DONE]\n\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.COMPAT_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  process.env.COMPAT_API_KEY = 'test-key';
  process.env.COMPAT_MODEL = 'some-model';
});

afterAll(() => {
  server.close();
  delete process.env.COMPAT_BASE_URL;
  delete process.env.COMPAT_API_KEY;
  delete process.env.COMPAT_MODEL;
});

describe('CompatibleProvider', () => {
  it('streams text, assembles chunked tool calls and sends tool results back', async () => {
    const provider = new CompatibleProvider();
    const config = provider.defaults();
    expect(provider.isConfigured(config)).toBe(true);
    const events: AgentEvent[] = [];
    const calls: unknown[] = [];
    await provider.run({
      system: 'sys',
      turns: [{ role: 'user', content: 'hi' }],
      tools: NOTE_TOOL_SPECS,
      emit: (event) => events.push(event),
      signal: new AbortController().signal,
      config,
      execute: async (id, name, input) => {
        calls.push({ id, name, input });
        return { output: '[{"title":"Deep Work"}]', isError: false };
      },
    });
    expect(calls).toEqual([{ id: 'call_1', name: 'search_pages', input: { query: 'Deep' } }]);
    expect(events.filter((e) => e.type === 'text').map((e) => (e as { delta: string }).delta).join('')).toBe('查一下。找到了。');
    expect(requests[0].messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(requests[0].tools).toHaveLength(NOTE_TOOL_SPECS.length);
    const followUp = requests[1].messages;
    expect(followUp.at(-2)).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'call_1', function: { name: 'search_pages' } }] });
    expect(followUp.at(-1)).toEqual({ role: 'tool', tool_call_id: 'call_1', content: '[{"title":"Deep Work"}]' });
  });
});
