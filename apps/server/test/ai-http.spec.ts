import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AgentRunInput } from '../src/ai/ai-types';
import { ClaudeProvider } from '../src/ai/claude-provider';
import { createApp } from '../src/create-app';

let app: NestExpressApplication;
let base: string;

beforeAll(async () => {
  process.env.DATABASE_URL = 'pglite:memory';
  app = await createApp();
  const claude = app.get(ClaudeProvider);
  Object.assign(claude, {
    isConfigured: () => true,
    run: async ({ execute, emit }: AgentRunInput) => {
      emit({ type: 'text', delta: '好的，' });
      await execute('t1', 'insert_blocks', { page_title: 'Inbox', blocks: [{ content: 'AI 写的块' }] });
      await execute('t2', 'delete_page', { title: 'Inbox' });
      emit({ type: 'text', delta: '完成。' });
    },
  });
  await app.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
});

afterAll(async () => {
  await app.close();
});

describe('agent permission', () => {
  it('defaults to edit and saves the chosen level', async () => {
    expect(await (await fetch(`${base}/ai/permission`)).json()).toEqual({ level: 'edit' });
    const bad = await fetch(`${base}/ai/permission`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'root' }) });
    expect(bad.status).toBe(400);
  });
});

describe('POST /api/ai/chat', () => {
  it('streams agent events as SSE and waits for confirmation on destructive tools', async () => {
    await fetch(`${base}/ai/permission`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'full' }) });
    const response = await fetch(`${base}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'claude', messages: [{ role: 'user', content: '写一块然后删页面' }] }),
    });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    const events: { type: string; [key: string]: unknown }[] = [];
    let buffer = '';
    while (!events.some((e) => e.type === 'done')) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      for (let i = buffer.indexOf('\n\n'); i >= 0; i = buffer.indexOf('\n\n')) {
        const event = JSON.parse(buffer.slice(0, i).replace(/^data: /, ''));
        buffer = buffer.slice(i + 2);
        events.push(event);
        if (event.type === 'confirm') {
          const runId = events.find((e) => e.type === 'run')!.runId as string;
          const res = await fetch(`${base}/ai/runs/${runId}/tools/${event.id}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved: false }),
          });
          expect(res.status).toBe(204);
        }
      }
    }
    expect(events.map((e) => e.type)).toEqual(['run', 'text', 'tool_call', 'tool_result', 'tool_call', 'confirm', 'tool_result', 'text', 'done']);
    expect(events[3]).toMatchObject({ ok: true, mutated: true });
    expect(events[6]).toMatchObject({ ok: false });
    const page = (await (await fetch(`${base}/pages/by-title/Inbox`)).json()) as { blocks: { content: string }[] };
    expect(page.blocks.map((b: { content: string }) => b.content)).toEqual(['AI 写的块']);
  });

  it('reports configured providers', async () => {
    const providers = (await (await fetch(`${base}/ai/providers`)).json()) as { id: string; configured: boolean }[];
    expect(providers.map((p: { id: string }) => p.id)).toEqual(['claude', 'openai', 'compatible']);
    expect(providers[0].configured).toBe(true);
  });
});
