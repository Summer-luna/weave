import { describe, expect, it } from 'vitest';
import { OutlineService } from '../src/services/outline-service';
import type { Block, Outline } from '../src/types/models';

const service = new OutlineService();

function block(id: string, parentId: string | null, position: number, content = id, open = true): Block {
  return { id, pageId: 'p', parentId, position, content, open, refCount: 0 };
}

function shape(outline: Outline, ids = outline.rootIds): unknown[] {
  return ids.map((id) => {
    const node = outline.nodes[id];
    return node.childIds.length ? [node.content, shape(outline, node.childIds)] : node.content;
  });
}

const base = () => service.build([block('a', null, 0), block('b', null, 1), block('b1', 'b', 0), block('c', null, 2)]);

describe('OutlineService.transition', () => {
  it('reverts arbitrary edits: create, delete, move, content and open changes', () => {
    const before = base();
    let after = service.insert(before, { id: 'n', content: 'new' }, { parentId: 'a', index: 0 });
    after = service.remove(after, 'b');
    after = service.move(after, 'c', { parentId: null, index: 0 });
    after = service.update(after, 'a', { content: 'A!', open: false });

    const undo = service.transition(after, before);
    expect(shape(undo.result)).toEqual(shape(before));
    expect(undo.result.nodes.a).toMatchObject({ content: 'a', open: true });
    expect(undo.ops.map((op) => op.type).sort()).toEqual(['create', 'create', 'move', 'move', 'remove', 'update'].sort());

    const redo = service.transition(undo.result, after);
    expect(shape(redo.result)).toEqual(shape(after));
  });

  it('returns no ops when nothing changed', () => {
    expect(service.transition(base(), base()).ops).toEqual([]);
  });

  it('moves children out before removing their old parent', () => {
    const before = base();
    let after = service.move(before, 'b1', { parentId: null, index: 0 });
    after = service.remove(after, 'b');
    const result = service.transition(before, after);
    expect(shape(result.result)).toEqual(['b1', 'a', 'c']);
  });
});

describe('selection and markdown helpers', () => {
  it('finds top-level selected blocks and visible ranges', () => {
    const outline = base();
    expect(service.rangeBetween(outline, 'c', 'a')).toEqual(['a', 'b', 'b1', 'c']);
    expect(service.topLevel(outline, ['b', 'b1', 'c'])).toEqual(['b', 'c']);
  });

  it('round-trips an outline through markdown', () => {
    const outline = base();
    const text = service.toMarkdown(outline, ['b', 'c']);
    expect(text).toBe('- b\n  - b1\n- c');
    expect(service.parseMarkdownOutline(text)).toEqual([
      { content: 'b', children: [{ content: 'b1', children: [] }] },
      { content: 'c', children: [] },
    ]);
    expect(service.parseMarkdownOutline('just one line')).toBeNull();
  });
});
