import { describe, expect, it } from 'vitest';
import { OutlineService } from '../src/services/outline-service';
import type { Block, Outline } from '../src/types/models';

const service = new OutlineService();

function block(id: string, parentId: string | null, position: number, open = true): Block {
  return { id, pageId: 'p', parentId, position, content: id, open, refCount: 0 };
}

function shape(outline: Outline, ids = outline.rootIds): unknown[] {
  return ids.map((id) => (outline.nodes[id].childIds.length ? [id, shape(outline, outline.nodes[id].childIds)] : id));
}

const base = () => service.build([block('a', null, 0), block('b', null, 1), block('c', null, 2), block('b1', 'b', 0)]);

describe('OutlineService', () => {
  it('builds a tree ordered by position', () => {
    expect(shape(base())).toEqual(['a', ['b', ['b1']], 'c']);
  });

  it('indents under the previous sibling and outdents after the parent', () => {
    const o = base();
    const indented = service.move(o, 'c', service.indentTarget(o, 'c')!);
    expect(shape(indented)).toEqual(['a', ['b', ['b1', 'c']]]);
    const outdented = service.move(indented, 'b1', service.outdentTarget(indented, 'b1')!);
    expect(shape(outdented)).toEqual(['a', ['b', ['c']], 'b1']);
    expect(service.indentTarget(o, 'a')).toBeNull();
    expect(service.outdentTarget(o, 'a')).toBeNull();
  });

  it('places split blocks as first child when the block has open children', () => {
    const o = base();
    expect(service.splitTarget(o, 'b')).toEqual({ parentId: 'b', index: 0 });
    expect(service.splitTarget(o, 'a')).toEqual({ parentId: null, index: 1 });
  });

  it('walks visible blocks and skips collapsed children', () => {
    const o = base();
    expect(service.visibleIds(o)).toEqual(['a', 'b', 'b1', 'c']);
    const collapsed = service.update(o, 'b', { open: false });
    expect(service.nextVisible(collapsed, 'b')).toBe('c');
    expect(service.previousVisible(collapsed, 'c')).toBe('b');
  });

  it('moves among siblings and computes drop targets without cycles', () => {
    const o = base();
    expect(shape(service.move(o, 'c', service.moveUpTarget(o, 'c')!))).toEqual(['a', 'c', ['b', ['b1']]]);
    expect(shape(service.move(o, 'a', service.moveDownTarget(o, 'a')!))).toEqual([['b', ['b1']], 'a', 'c']);
    expect(service.dropTarget(o, 'b', 'b1', 'after')).toBeNull();
    expect(service.dropTarget(o, 'a', 'c', 'after')).toEqual({ parentId: null, index: 2 });
  });

  it('removes a block together with its descendants', () => {
    const removed = service.remove(base(), 'b');
    expect(shape(removed)).toEqual(['a', 'c']);
    expect(removed.nodes.b1).toBeUndefined();
  });
});
