import { aiPreferencesRepository } from '../repositories/ai-preferences-repository';
import { aiRepository } from '../repositories/ai-repository';
import type { AiChatItem, AiChatRequest, AiChatState, AiEvent, AiProviderId, AiScope, AiToolStep } from '../types/models';
import { dailyNoteService } from './daily-note-service';
import { saveQueue } from './save-queue';

type AssistantItem = Extract<AiChatItem, { role: 'assistant' }>;

export interface AiPreset {
  key: string;
  label: string;
  scope: AiScope;
  prompt(pageTitle: string): string;
}

export const AI_PRESETS: AiPreset[] = [
  {
    key: 'organize',
    label: '整理这一页',
    scope: 'page',
    prompt: (title) =>
      `整理页面 [[${title}]]：读一遍内容，先搜索已有页面，然后用 add_page_tags 加 3-6 个合适的标签，把正文里重要的概念、人名、书名改成 [[双链]]（尽量用已有页面的标题，不改原文措辞），再把其他页面里对它的未链接提及变成链接。最后简短告诉我改了什么。`,
  },
  {
    key: 'summarize',
    label: '总结这一页',
    scope: 'page',
    prompt: (title) => `总结页面 [[${title}]] 的内容，把总结作为一个"总结"块（下面几条子块）插到页面最上方（标签块之后），然后在对话里给我一句话概括。`,
  },
  {
    key: 'analyze',
    label: '分析观点',
    scope: 'page',
    prompt: (title) =>
      `分析页面 [[${title}]]：结合它的反向链接和相关页面，指出主要观点、它们之间的联系、可能的矛盾或遗漏，以及值得延伸的问题。只在对话里回答，用 ((块引用)) 标出依据，不要修改笔记。`,
  },
  {
    key: 'connections',
    label: '在全库里找相关笔记',
    scope: 'library',
    prompt: (title) =>
      `在整个笔记库里找和 [[${title}]] 相关、但还没有互相链接的笔记，列出最值得关注的几条（用 ((块引用)) 标出），说明它们和这一页的关系，并问我要不要把它们链接起来。先不要修改笔记。`,
  },
];

let seq = 0;
const nextId = () => `ai-${Date.now().toString(36)}-${++seq}`;

export class AiChatStore {
  private state: AiChatState = {
    items: [],
    running: false,
    runId: null,
    provider: aiPreferencesRepository.loadProvider() ?? 'claude',
    scope: aiPreferencesRepository.loadScope(),
  };
  private readonly listeners = new Set<() => void>();
  private readonly mutationListeners = new Set<() => void>();
  private abort: AbortController | null = null;

  snapshot(): AiChatState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onMutated(listener: () => void): () => void {
    this.mutationListeners.add(listener);
    return () => this.mutationListeners.delete(listener);
  }

  setProvider(provider: AiProviderId): void {
    aiPreferencesRepository.saveProvider(provider);
    this.set({ provider });
  }

  setScope(scope: AiScope): void {
    aiPreferencesRepository.saveScope(scope);
    this.set({ scope });
  }

  clear(): void {
    if (this.state.running) return;
    this.set({ items: [] });
  }

  stop(): void {
    this.abort?.abort();
  }

  async send(text: string, pageTitle: string | undefined, scope: AiScope = this.state.scope): Promise<void> {
    const content = text.trim();
    if (!content || this.state.running) return;
    const user: AiChatItem = { id: nextId(), role: 'user', text: content };
    const assistant: AssistantItem = { id: nextId(), role: 'assistant', text: '', steps: [], parts: [], notices: [], status: 'streaming' };
    const history: AiChatRequest['messages'] = this.state.items.flatMap((item): AiChatRequest['messages'] =>
      item.role === 'user' ? [{ role: 'user', content: item.text }] : item.text ? [{ role: 'assistant', content: item.text }] : [],
    );
    this.abort = new AbortController();
    this.set({ items: [...this.state.items, user, assistant], running: true, runId: null });

    try {
      // The agent reads notes from the server, so unsaved edits must land first.
      await saveQueue.drain();
      await aiRepository.chat(
        {
          provider: this.state.provider,
          messages: [...history, { role: 'user', content }],
          pageTitle,
          scope,
          today: dailyNoteService.today(),
        },
        (event) => this.apply(assistant.id, event),
        this.abort.signal,
      );
      this.patch(assistant.id, (item) => (item.status === 'streaming' ? { ...item, status: 'done' } : item));
    } catch (error) {
      const aborted = this.abort?.signal.aborted;
      this.patch(assistant.id, (item) => ({
        ...item,
        status: aborted ? 'done' : 'error',
        error: aborted ? undefined : error instanceof Error ? error.message : String(error),
        notices: aborted ? [...item.notices, '已停止'] : item.notices,
        steps: item.steps.map((step) => (step.status === 'running' || step.status === 'confirm' ? { ...step, status: 'error' } : step)),
      }));
    } finally {
      this.abort = null;
      this.set({ running: false, runId: null });
    }
  }

  async undoRun(itemId: string): Promise<void> {
    const item = this.state.items.find((i) => i.id === itemId);
    if (!item || item.role !== 'assistant' || !item.runId || item.undo !== 'available') return;
    this.patch(itemId, (i) => ({ ...i, undo: 'running' }));
    try {
      const result = await aiRepository.undoRun(item.runId);
      this.patch(itemId, (i) => ({ ...i, undo: 'done', notices: [...i.notices, `已撤销这次改动（${result.pages.join('、')}）`] }));
      for (const listener of this.mutationListeners) listener();
    } catch (error) {
      this.patch(itemId, (i) => ({ ...i, undo: 'available', notices: [...i.notices, `撤销失败：${error instanceof Error ? error.message : error}`] }));
    }
  }

  async confirm(stepId: string, approved: boolean): Promise<void> {
    const runId = this.state.runId;
    if (!runId) return;
    this.updateStep(stepId, (step) => ({ ...step, status: 'running' }));
    await aiRepository.confirm(runId, stepId, approved);
  }

  private apply(itemId: string, event: AiEvent): void {
    switch (event.type) {
      case 'run':
        this.set({ runId: event.runId });
        this.patch(itemId, (item) => ({ ...item, model: event.model, runId: event.runId }));
        break;
      case 'text':
        this.patch(itemId, (item) => {
          const last = item.parts[item.parts.length - 1];
          const parts =
            last?.kind === 'text'
              ? [...item.parts.slice(0, -1), { kind: 'text' as const, text: last.text + event.delta }]
              : [...item.parts, { kind: 'text' as const, text: event.delta }];
          return { ...item, text: item.text + event.delta, parts };
        });
        break;
      case 'tool_call':
        this.patch(itemId, (item) => ({
          ...item,
          steps: [...item.steps, { id: event.id, name: event.name, input: event.input, status: 'running' }],
          parts: [...item.parts, { kind: 'step', id: event.id }],
        }));
        break;
      case 'confirm':
        this.updateStep(event.id, (step) => ({ ...step, status: 'confirm' }));
        break;
      case 'tool_result':
        this.updateStep(event.id, (step) => ({ ...step, status: event.ok ? 'ok' : 'error', output: event.output }));
        if (event.mutated) for (const listener of this.mutationListeners) listener();
        break;
      case 'notice':
        this.patch(itemId, (item) => ({ ...item, notices: [...item.notices, event.message] }));
        break;
      case 'error':
        this.patch(itemId, (item) => ({ ...item, status: 'error', error: event.message }));
        break;
      case 'done':
        if (event.undoable) this.patch(itemId, (item) => ({ ...item, undo: 'available' }));
        break;
    }
  }

  private updateStep(stepId: string, change: (step: AiToolStep) => AiToolStep): void {
    const owner = this.state.items.find((item) => item.role === 'assistant' && item.steps.some((s) => s.id === stepId));
    if (!owner) return;
    this.patch(owner.id, (item) => ({ ...item, steps: item.steps.map((s) => (s.id === stepId ? change(s) : s)) }));
  }

  private patch(itemId: string, change: (item: AssistantItem) => AssistantItem): void {
    this.set({
      items: this.state.items.map((item) => (item.id === itemId && item.role === 'assistant' ? change(item) : item)),
    });
  }

  private set(patch: Partial<AiChatState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

export const aiChatStore = new AiChatStore();
