import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { uid } from '../common/uid';
import { AgentPermissionService } from './agent-permission.service';
import { AgentEvent, AgentPermissionLevel, AiProviderId, ChatTurn, ToolOutcome, ToolSpec } from './ai-types';
import { AiRunJournal } from './ai-run-journal';
import { AiSettingsService } from './ai-settings.service';
import { ConfirmationRegistry } from './confirmation-registry';
import { NOTE_TOOL_SPECS } from './note-tool-specs';
import { NoteToolkit } from './note-toolkit';

const MAX_TOOL_OUTPUT_CHARS = 60_000;
const MAX_HISTORY_TURNS = 40;

const SYSTEM_PROMPT = `You are the assistant built into Weave, an outliner note-taking app with bidirectional links. You can read and change the user's notes through tools.

How notes work:
- A page is a tree of blocks; each block is one bullet with its own id.
- [[Page title]] links to a page, #tag or #[[multi word tag]] also links to a page, ((blockId)) embeds a reference to another block.
- **bold**, __italic__, ^^highlight^^ and \`code\` are inline formatting. A block starting with "[ ] " is an open todo, "[x] " a done todo.
- Daily notes are pages titled with the date, e.g. 2026-11-05.

How to work:
- For questions about the notes in general, search the whole library first: call search_notes with several keywords, synonyms and Chinese/English variants, read the most relevant pages, then answer only from what you found and say when the notes don't cover something.
- Read before you write: use read_page / read_block / search tools to see the real content and ids. Never invent block ids.
- When adding links or tags, search for existing pages first and reuse their exact titles so the graph stays connected.
- Preserve the user's own wording. When asked to organize a page, add markup ([[links]], #tags, structure) rather than rewriting text, unless the user asks for a rewrite.
- Summaries, analyses and new content you write go into new blocks (insert_blocks) unless the user only wants an answer in chat.
- When you cite notes in your reply, reference blocks as ((blockId)) and pages as [[Page title]] so the user can click them.
- You can do what the user can do in the app: pages, blocks, todos, collapsing, tags, links, block references, templates (pages titled "模板/…"), daily notes and the calendar, favourites and the trash.
- Attachments are blocks with markdown such as ![name](/api/files/id) or [name](/api/files/id); you cannot upload files, but you can move, copy or reference those blocks. Model and API key settings are only changed by the user in 设置 → Agent.
- Deleted pages and blocks go to the trash and can be restored with restore_from_trash. Deleting still needs the user's confirmation; only delete when the user asked for it. Deleting from the trash or emptying it is permanent.
- Keep replies short and reply in the language the user writes in.`;

export interface ChatRequest {
  provider: AiProviderId;
  messages: ChatTurn[];
  pageTitle?: string;
  today?: string;
  scope?: 'page' | 'library';
}

@Injectable()
export class AgentService {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly toolkit: NoteToolkit,
    private readonly confirmations: ConfirmationRegistry,
    private readonly journal: AiRunJournal,
    private readonly permissions: AgentPermissionService,
  ) {}

  async listProviders() {
    return Promise.all(
      this.settings.providers.map(async (p) => {
        const config = await this.settings.resolve(p.id);
        return { id: p.id, label: config.label, model: config.model, configured: p.isConfigured(config) };
      }),
    );
  }

  undoRun(runId: string): Promise<{ pages: string[] }> {
    return this.journal.undo(runId);
  }

  confirm(runId: string, callId: string, approved: boolean): boolean {
    return this.confirmations.resolve(runId, callId, approved);
  }

  async run(request: ChatRequest, emit: (event: AgentEvent) => void, signal: AbortSignal): Promise<void> {
    const provider = this.settings.provider(request.provider);
    const config = await this.settings.resolve(provider.id);
    if (!provider.isConfigured(config)) throw new BadRequestException(`${config.label} 还没有配置，请到「设置 → Agent」里填写`);
    const level = await this.permissions.get();
    const tools = NOTE_TOOL_SPECS.filter((spec) => this.permissions.allows(level, spec));
    const turns = this.prepareTurns(request, level);
    const runId = uid();
    emit({ type: 'run', runId, provider: provider.id, model: config.model });
    try {
      await provider.run({
        system: SYSTEM_PROMPT,
        turns,
        tools,
        execute: (callId, name, input) => this.executeTool(tools, runId, callId, name, input, emit, signal),
        emit,
        signal,
        config,
      });
    } catch (error) {
      if (!signal.aborted) emit({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
    emit({ type: 'done', undoable: this.journal.hasChanges(runId) });
  }

  private prepareTurns(request: ChatRequest, level: AgentPermissionLevel): ChatTurn[] {
    const turns = request.messages.filter((t) => t.content.trim()).slice(-MAX_HISTORY_TURNS);
    while (turns.length && turns[0].role !== 'user') turns.shift();
    const last = turns[turns.length - 1];
    if (!last || last.role !== 'user') throw new BadRequestException('最后一条消息必须来自用户');
    // Per-request context rides on the newest user turn so the stable system prompt and tools stay cacheable.
    const context = [`Today: ${request.today ?? new Date().toISOString().slice(0, 10)}`];
    if (level === 'read') context.push('Permission: read-only. You cannot change notes; if asked to, say the user can allow edits in 设置 → Agent.');
    if (level === 'edit') context.push('Permission: no deleting. If asked to delete, say the user can allow it in 设置 → Agent.');
    if (request.pageTitle) context.push(`The user is looking at the page [[${request.pageTitle}]].`);
    if (request.scope === 'library') context.push('Answer from the whole note library, not just the current page: search broadly with search_notes before answering, and cite ((blockId)) for every claim.');
    turns[turns.length - 1] = { role: 'user', content: `<context>\n${context.join('\n')}\n</context>\n\n${last.content}` };
    return turns;
  }

  private async executeTool(
    tools: ToolSpec[],
    runId: string,
    callId: string,
    name: string,
    input: unknown,
    emit: (event: AgentEvent) => void,
    signal: AbortSignal,
  ): Promise<ToolOutcome> {
    emit({ type: 'tool_call', id: callId, name, input });
    const spec = tools.find((s) => s.name === name);
    const fail = (message: string): ToolOutcome => {
      emit({ type: 'tool_result', id: callId, ok: false, output: message, mutated: false });
      return { output: message, isError: true };
    };
    if (!spec) {
      const known = NOTE_TOOL_SPECS.some((s) => s.name === name);
      return fail(known ? `Tool ${name} is not allowed at the current permission level (设置 → Agent).` : `Unknown tool: ${name}`);
    }
    const parsed = spec.schema.safeParse(input);
    if (!parsed.success) return fail(`Invalid input: ${parsed.error.message}`);
    if (spec.destructive && !(await this.approve(spec, runId, callId, parsed.data, emit, signal))) {
      return fail('The user declined this action.');
    }
    try {
      await this.journal.beforeTool(runId, name, parsed.data as Record<string, unknown>);
      const result = await this.toolkit.execute(name, parsed.data as Record<string, unknown>);
      this.journal.afterTool(runId, result.createdPages);
      const text = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
      const output = text.length > MAX_TOOL_OUTPUT_CHARS ? `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}…(truncated)` : text;
      emit({ type: 'tool_result', id: callId, ok: true, output: output.slice(0, 2000), mutated: result.mutated });
      return { output, isError: false };
    } catch (error) {
      const message = error instanceof HttpException ? error.message : error instanceof Error ? error.message : String(error);
      return fail(message);
    }
  }

  private approve(spec: ToolSpec, runId: string, callId: string, input: unknown, emit: (event: AgentEvent) => void, signal: AbortSignal) {
    emit({ type: 'confirm', id: callId, name: spec.name, input });
    return this.confirmations.wait(runId, callId, signal);
  }
}
