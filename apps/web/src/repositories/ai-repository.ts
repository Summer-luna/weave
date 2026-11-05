import type { AiChatRequest, AiEvent, AiProvider } from '../types/models';
import { ApiError, apiClient, unwrap } from './api-client';

export class AiRepository {
  providers(): Promise<AiProvider[]> {
    return unwrap(apiClient.GET('/api/ai/providers'));
  }

  undoRun(runId: string): Promise<{ pages: string[] }> {
    return unwrap(apiClient.POST('/api/ai/runs/{runId}/undo', { params: { path: { runId } } }));
  }

  async confirm(runId: string, callId: string, approved: boolean): Promise<void> {
    await unwrap(apiClient.POST('/api/ai/runs/{runId}/tools/{callId}/confirm', { params: { path: { runId, callId } }, body: { approved } }));
  }

  async chat(request: AiChatRequest, onEvent: (event: AiEvent) => void, signal: AbortSignal): Promise<void> {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
      const message = Array.isArray(body?.message) ? body.message.join('；') : body?.message;
      throw new ApiError(response.status, message ?? `AI 请求失败（${response.status}）`);
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = chunk
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) onEvent(JSON.parse(data) as AiEvent);
        boundary = buffer.indexOf('\n\n');
      }
    }
  }
}

export const aiRepository = new AiRepository();
