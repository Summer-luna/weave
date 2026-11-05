import { describe, expect, it } from 'vitest';
import { HistoryStore } from '../src/services/history-store';
import type { Outline } from '../src/types/models';

const state = (label: string): Outline => ({ rootIds: [label], nodes: {} });

describe('HistoryStore', () => {
  it('undoes and redoes in order and merges consecutive typing in one block', () => {
    const store = new HistoryStore();
    const applied: string[] = [];
    const apply = (target: Outline) => applied.push(target.rootIds[0]);
    store.record({ before: state('0'), after: state('1'), mergeKey: 'content:a', apply });
    store.record({ before: state('1'), after: state('2'), mergeKey: 'content:a', apply });
    store.record({ before: state('2'), after: state('3'), apply });

    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(applied).toEqual(['2', '0']);
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(true);
    expect(applied.at(-1)).toBe('2');
  });

  it('clears redo history after a new change', () => {
    const store = new HistoryStore();
    const apply = () => undefined;
    store.record({ before: state('0'), after: state('1'), apply });
    store.undo();
    store.record({ before: state('0'), after: state('x'), apply });
    expect(store.redo()).toBe(false);
  });
});
