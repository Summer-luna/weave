import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { completionSources } from '../src/components/editor/editor-extensions';
import type { AutocompleteSources } from '../src/controllers/use-autocomplete-sources';

const sources: AutocompleteSources = {
  searchPages: async () => [],
  searchBlocks: async () => [],
  listTemplates: async () => ['模板/周报'],
  dateTitle: (offset) => `2026-11-0${5 + offset}`,
  timeNow: () => '09:30',
};

async function slashAt(doc: string) {
  const state = EditorState.create({ doc, selection: { anchor: doc.length } });
  const [slash] = completionSources(sources, { onTemplate: () => undefined, onAttach: () => undefined });
  return slash(new CompletionContext(state, doc.length, false));
}

describe('slash commands', () => {
  it('opens after a space or at the start and excludes the slash from the filter text', async () => {
    const result = await slashAt('会议 /jt');
    expect(result).not.toBeNull();
    expect(result!.from).toBe('会议 /'.length);
    expect(result!.options.map((o) => o.displayLabel)).toEqual(['今天']);
    expect((await slashAt('/db'))!.options.map((o) => o.displayLabel)).toEqual(['待办']);
    expect((await slashAt('/模板'))!.options.map((o) => o.displayLabel)).toEqual(['模板：周报']);
    expect((await slashAt('/'))!.options.length).toBeGreaterThan(10);
  });

  it('does not trigger inside words or paths', async () => {
    expect(await slashAt('a/b')).toBeNull();
    expect(await slashAt('https://x.com/')).toBeNull();
  });
});
