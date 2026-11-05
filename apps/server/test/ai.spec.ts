import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentPermissionService } from '../src/ai/agent-permission.service';
import { AgentService } from '../src/ai/agent.service';
import { AiRunJournal } from '../src/ai/ai-run-journal';
import { AiSettingsService } from '../src/ai/ai-settings.service';
import type { AgentEvent, AgentRunInput } from '../src/ai/ai-types';
import { ClaudeProvider } from '../src/ai/claude-provider';
import { CompatibleProvider } from '../src/ai/compatible-provider';
import { ConfirmationRegistry } from '../src/ai/confirmation-registry';
import { NOTE_TOOL_SPECS } from '../src/ai/note-tool-specs';
import { NoteToolkit } from '../src/ai/note-toolkit';
import { OpenAiProvider } from '../src/ai/openai-provider';
import { toolJsonSchema } from '../src/ai/tool-json-schema';
import { AppSettingsRepository } from '../src/storage/app-settings.repository';
import { BlockRepository } from '../src/storage/block.repository';
import { TrashService } from '../src/trash/trash.service';
import { createHarness, Harness } from './harness';

let h: Harness;
let toolkit: NoteToolkit;
let trash: TrashService;
let permissions: AgentPermissionService;

beforeEach(async () => {
  h = await createHarness();
  trash = new TrashService(h.trashRepository, h.pageRepository, new BlockRepository(h.database), h.pages, h.restorer, h.database);
  toolkit = new NoteToolkit(h.pages, h.blocks, trash);
  permissions = new AgentPermissionService(new AppSettingsRepository(h.database));
  await permissions.set('full');
});

afterEach(async () => {
  await h.close();
});

describe('NoteToolkit', () => {
  it('reads a page as an outline with ids and references', async () => {
    const page = await h.pages.ensure('Journal');
    const parent = await h.blocks.create({ pageId: page.id, content: '读书' });
    await h.blocks.create({ pageId: page.id, parentId: parent.id, content: '读 [[Deep Work]]' });
    const result = await toolkit.execute('read_page', { title: 'Journal' });
    expect(result.mutated).toBe(false);
    expect(result.output).toContain(`- [${parent.id}] 读书`);
    expect(result.output).toContain('  - [');
    const deep = (await toolkit.execute('read_page', { title: 'Deep Work' })).output as string;
    expect(deep).toContain('Linked references (1)');
    expect(deep).toContain('from [[Journal]]');
  });

  it('inserts nested blocks and merges page tags into one tag block', async () => {
    await toolkit.execute('insert_blocks', {
      page_title: 'Notes',
      blocks: [{ content: '要点', children: [{ content: '第一点' }, { content: '第二点' }] }],
    });
    await toolkit.execute('add_page_tags', { title: 'Notes', tags: ['读书', 'Deep Work'] });
    await toolkit.execute('add_page_tags', { title: 'Notes', tags: ['#读书', 'focus'] });
    const detail = await h.pages.detail('Notes');
    const roots = detail.blocks.filter((b) => b.parentId === null).sort((a, b) => a.position - b.position);
    expect(roots[0].content).toBe('标签：#读书 #[[Deep Work]] #focus');
    expect(roots[1].content).toBe('要点');
    expect(detail.blocks.filter((b) => b.parentId === roots[1].id)).toHaveLength(2);
    expect((await h.pages.detail('focus')).page).not.toBeNull();
  });

  it('links unlinked mentions', async () => {
    await h.pages.ensure('Rust');
    const other = await h.pages.ensure('Ideas');
    const block = await h.blocks.create({ pageId: other.id, content: 'learn rust soon' });
    const result = await toolkit.execute('link_unlinked_mentions', { title: 'Rust' });
    expect(result.output).toMatchObject({ linked: [block.id] });
    expect((await h.blocks.get(block.id)).content).toBe('learn [[rust]] soon');
  });
});

describe('UI-parity tools', () => {
  it('lists daily notes and templates, applies templates, toggles todos and collapses blocks', async () => {
    const daily = await h.pages.ensure('2026-11-05');
    const task = await h.blocks.create({ pageId: daily.id, content: '写周报' });
    await h.blocks.create({ pageId: daily.id, parentId: task.id, content: '细节' });
    await h.pages.ensure('2026-11-06');
    const template = await h.pages.ensure('模板/周报');
    const section = await h.blocks.create({ pageId: template.id, content: '本周' });
    await h.blocks.create({ pageId: template.id, parentId: section.id, content: '[ ] ' });

    expect((await toolkit.execute('list_daily_notes', { month: '2026-11' })).output).toEqual([{ title: '2026-11-05', blocks: 2 }]);
    expect((await toolkit.execute('list_templates', {})).output).toEqual([{ title: '模板/周报', blocks: 2 }]);

    await toolkit.execute('apply_template', { template_title: '模板/周报', page_title: 'Week 45' });
    const week = await h.pages.detail('Week 45');
    const root = week.blocks.find((b) => b.parentId === null);
    expect(root?.content).toBe('本周');
    expect(week.blocks.find((b) => b.parentId === root?.id)?.content).toBe('[ ] ');

    await toolkit.execute('set_todo', { id: task.id, state: 'todo' });
    await toolkit.execute('set_todo', { id: task.id, state: 'done' });
    expect((await h.blocks.get(task.id)).content).toBe('[x] 写周报');
    await toolkit.execute('set_todo', { id: task.id, state: 'none' });
    expect((await h.blocks.get(task.id)).content).toBe('写周报');

    await toolkit.execute('set_block_collapsed', { id: task.id, collapsed: true });
    expect((await h.blocks.get(task.id)).open).toBe(false);
  });

  it('finds block references and restores items from the trash', async () => {
    const page = await h.pages.ensure('Notes');
    const target = await h.blocks.create({ pageId: page.id, content: 'source' });
    const other = await h.pages.ensure('Other');
    const ref = await h.blocks.create({ pageId: other.id, content: `see ((${target.id}))` });
    expect((await toolkit.execute('get_block_references', { id: target.id })).output).toEqual([
      { page: 'Other', blocks: [{ id: ref.id, content: `see ((${target.id}))` }] },
    ]);

    await h.pages.remove(other.id);
    const [item] = (await toolkit.execute('list_trash', {})).output as { id: string; label: string }[];
    expect(item.label).toBe('Other');
    const result = await toolkit.execute('restore_from_trash', { id: item.id });
    expect(result.createdPages).toEqual(['Other']);
    expect((await h.pages.detail('Other')).blocks.map((b) => b.content)).toEqual([`see ((${target.id}))`]);
  });
});

describe('tool specs', () => {
  it('produce object JSON schemas without $schema', () => {
    for (const spec of NOTE_TOOL_SPECS) {
      const schema = toolJsonSchema(spec);
      expect(schema.type).toBe('object');
      expect(schema).not.toHaveProperty('$schema');
    }
  });
});

describe('AgentService', () => {
  function serviceWith(script: (input: AgentRunInput) => Promise<void>) {
    const claude = new ClaudeProvider();
    Object.assign(claude, { isConfigured: () => true, run: script });
    const confirmations = new ConfirmationRegistry();
    const settings = new AiSettingsService(h.aiSettings, claude, new OpenAiProvider(), new CompatibleProvider());
    const journal = new AiRunJournal(h.pages, h.pageRepository, h.blocks, h.restorer, h.database, trash);
    return { service: new AgentService(settings, toolkit, confirmations, journal, permissions), confirmations };
  }

  it('validates tool input, runs tools and asks before destructive ones', async () => {
    const page = await h.pages.ensure('Inbox');
    const block = await h.blocks.create({ pageId: page.id, content: 'temp' });
    const outcomes: unknown[] = [];
    const { service } = serviceWith(async ({ execute, emit }) => {
      outcomes.push(await execute('c1', 'update_block', { id: block.id }));
      outcomes.push(await execute('c2', 'update_block', { id: block.id, content: 'changed' }));
      outcomes.push(await execute('c3', 'delete_block', { id: block.id }));
      emit({ type: 'text', delta: 'done' });
    });
    const events: AgentEvent[] = [];
    await service.run(
      { provider: 'claude', messages: [{ role: 'user', content: 'go' }] },
      (event) => {
        events.push(event);
        if (event.type === 'confirm') {
          const run = events.find((e) => e.type === 'run') as { runId: string };
          setTimeout(() => service.confirm(run.runId, event.id, false), 0);
        }
      },
      new AbortController().signal,
    );
    expect(outcomes.map((o) => (o as { isError: boolean }).isError)).toEqual([true, false, true]);
    expect((await h.blocks.get(block.id)).content).toBe('changed');
    expect(events.map((e) => e.type)).toContain('confirm');
    expect(events.at(-1)).toEqual({ type: 'done', undoable: true });
  });

  it('only offers the tools the permission level allows', async () => {
    const page = await h.pages.ensure('Inbox');
    const block = await h.blocks.create({ pageId: page.id, content: 'keep' });
    const offered: Record<string, string[]> = {};
    const outcomes: Record<string, unknown> = {};
    for (const level of ['read', 'edit', 'full'] as const) {
      await permissions.set(level);
      const { service } = serviceWith(async ({ tools, execute }) => {
        offered[level] = tools.map((t) => t.name);
        outcomes[level] = await execute('c1', 'update_block', { id: block.id, content: `changed by ${level}` });
      });
      await service.run({ provider: 'claude', messages: [{ role: 'user', content: 'go' }] }, () => {}, new AbortController().signal);
    }
    expect(offered.read).toContain('read_page');
    expect(offered.read).not.toContain('update_block');
    expect(offered.edit).toContain('update_block');
    expect(offered.edit).not.toContain('delete_block');
    expect(offered.full).toContain('empty_trash');
    expect(outcomes.read).toMatchObject({ isError: true });
    expect((await h.blocks.get(block.id)).content).toBe('changed by full');
    expect(await new AgentPermissionService(new AppSettingsRepository(h.database)).get()).toBe('full');
  });

  it('puts page context on the newest user turn and rejects unconfigured providers', async () => {
    let seen: AgentRunInput | undefined;
    const { service } = serviceWith(async (input) => {
      seen = input;
    });
    await service.run(
      { provider: 'claude', pageTitle: 'Deep Work', today: '2026-11-05', messages: [{ role: 'assistant', content: 'hi' }, { role: 'user', content: '整理' }] },
      () => undefined,
      new AbortController().signal,
    );
    expect(seen!.turns).toHaveLength(1);
    expect(seen!.turns[0].content).toContain('[[Deep Work]]');
    expect(seen!.turns[0].content).toContain('2026-11-05');

    const unconfigured = new AgentService(
      new AiSettingsService(h.aiSettings, new ClaudeProvider(), new OpenAiProvider(), new CompatibleProvider()),
      toolkit,
      new ConfirmationRegistry(),
      new AiRunJournal(h.pages, h.pageRepository, h.blocks, h.restorer, h.database, trash),
      permissions,
    );
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(
      unconfigured.run({ provider: 'openai', messages: [{ role: 'user', content: 'x' }] }, () => undefined, new AbortController().signal),
    ).rejects.toThrow();
    if (previous) process.env.OPENAI_API_KEY = previous;
  });
});

describe('library search', () => {
  it('ranks blocks by how many keywords they match and includes ancestor context', async () => {
    const a = await h.pages.ensure('A');
    const parent = await h.blocks.create({ pageId: a.id, content: '读书' });
    const both = await h.blocks.create({ pageId: a.id, parentId: parent.id, content: '专注 和 deep work 的关系' });
    const b = await h.pages.ensure('B');
    const one = await h.blocks.create({ pageId: b.id, content: '保持专注' });
    await h.blocks.create({ pageId: b.id, content: '无关内容' });
    const result = await toolkit.execute('search_notes', { keywords: ['专注', 'Deep Work'] });
    const hits = result.output as { id: string; matched: number; context?: string }[];
    expect(hits.map((x) => x.id)).toEqual([both.id, one.id]);
    expect(hits[0]).toMatchObject({ matched: 2, context: '读书' });
  });
});

describe('AiSettingsService', () => {
  it('prefers saved settings over environment defaults and never exposes the full key', async () => {
    const previous = process.env.COMPAT_API_KEY;
    process.env.COMPAT_API_KEY = 'env-key-1234567890';
    const settings = new AiSettingsService(h.aiSettings, new ClaudeProvider(), new OpenAiProvider(), new CompatibleProvider());
    let [, , compat] = await settings.list();
    expect(compat).toMatchObject({ keySource: 'env', configured: false, keyPreview: 'env…7890' });

    compat = await settings.update('compatible', { label: '星诺', baseUrl: 'https://gw.example.com/v1/', model: 'claude-x', apiKey: 'sk-secret-abcdef' });
    expect(compat).toMatchObject({ keySource: 'settings', keyPreview: 'sk-…cdef', configured: true, effectiveLabel: '星诺', baseUrl: 'https://gw.example.com/v1' });
    expect(JSON.stringify(compat)).not.toContain('sk-secret-abcdef');
    expect(await settings.resolve('compatible')).toEqual({ label: '星诺', baseUrl: 'https://gw.example.com/v1', model: 'claude-x', apiKey: 'sk-secret-abcdef' });

    await settings.update('compatible', { model: 'other' });
    expect((await settings.resolve('compatible')).apiKey).toBe('sk-secret-abcdef');
    await settings.update('compatible', { apiKey: '' });
    expect((await settings.resolve('compatible')).apiKey).toBe('env-key-1234567890');
    await expect(settings.update('compatible', { baseUrl: 'gw.example.com' })).rejects.toThrow();

    if (previous === undefined) delete process.env.COMPAT_API_KEY;
    else process.env.COMPAT_API_KEY = previous;
  });
});

describe('undoing an AI run', () => {
  it('restores every page the run touched, including deleted and newly created ones', async () => {
    const page = await h.pages.ensure('Journal');
    const keep = await h.blocks.create({ pageId: page.id, content: '原文 deep work' });
    const child = await h.blocks.create({ pageId: page.id, parentId: keep.id, content: '子块' });
    const doomed = await h.pages.ensure('Old');
    await h.blocks.create({ pageId: doomed.id, content: '要被删的页' });
    const before = await h.pages.detail('Journal');
    const trashed = await h.pages.ensure('Trashed');
    await h.blocks.create({ pageId: trashed.id, content: '回收站里的页' });
    await h.pages.remove(trashed.id);
    const trashedId = (await trash.list())[0].id;

    const claude = new ClaudeProvider();
    let runId = '';
    Object.assign(claude, {
      isConfigured: () => true,
      run: async ({ execute }: AgentRunInput) => {
        await execute('1', 'update_block', { id: keep.id, content: '原文 [[deep work]]' });
        await execute('2', 'move_block', { id: child.id, parent_id: null, index: 0 });
        await execute('3', 'insert_blocks', { page_title: 'Journal', blocks: [{ content: '总结', children: [{ content: '一' }] }] });
        await execute('4', 'add_page_tags', { title: 'Journal', tags: ['读书'] });
        await execute('5', 'insert_blocks', { page_title: 'Brand New', blocks: [{ content: 'x' }] });
        await execute('6', 'delete_page', { title: 'Old' });
        await execute('7', 'rename_page', { title: 'Journal', new_title: 'Diary' });
        await execute('8', 'restore_from_trash', { id: trashedId });
        await execute('9', 'set_todo', { id: keep.id, state: 'todo' });
      },
    });
    const settings = new AiSettingsService(h.aiSettings, claude, new OpenAiProvider(), new CompatibleProvider());
    const confirmations = new ConfirmationRegistry();
    const journal = new AiRunJournal(h.pages, h.pageRepository, h.blocks, h.restorer, h.database, trash);
    const service = new AgentService(settings, toolkit, confirmations, journal, permissions);
    const events: AgentEvent[] = [];
    await service.run(
      { provider: 'claude', messages: [{ role: 'user', content: 'go' }] },
      (event) => {
        events.push(event);
        if (event.type === 'run') runId = event.runId;
        if (event.type === 'confirm') setTimeout(() => service.confirm(runId, event.id, true), 0);
      },
      new AbortController().signal,
    );
    expect((await h.pages.detail('Old')).page).toBeNull();
    expect((await h.pages.detail('Diary')).page).not.toBeNull();

    await service.undoRun(runId);
    const after = await h.pages.detail('Journal');
    const simplify = (blocks: { id: string; parentId: string | null; position: number; content: string }[]) =>
      blocks.map(({ id, parentId, position, content }) => ({ id, parentId, position, content })).sort((a, b) => a.id.localeCompare(b.id));
    expect(after.page?.id).toBe(page.id);
    expect(simplify(after.blocks)).toEqual(simplify(before.blocks));
    expect((await h.pages.detail('Old')).blocks.map((b) => b.content)).toEqual(['要被删的页']);
    expect((await h.pages.detail('Brand New')).page).toBeNull();
    expect((await h.pages.detail('Diary')).page).toBeNull();
    expect((await h.pages.detail('Trashed')).page).toBeNull();
    expect((await trash.list()).map((item) => item.label)).toContain('Trashed');
    await expect(service.undoRun(runId)).rejects.toThrow();
  });
});
