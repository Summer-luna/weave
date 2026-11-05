import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrashService } from '../src/trash/trash.service';
import { BlockRepository } from '../src/storage/block.repository';
import { createHarness, Harness } from './harness';

let h: Harness;
let trash: TrashService;

beforeEach(async () => {
  h = await createHarness();
  trash = new TrashService(h.trashRepository, h.pageRepository, new BlockRepository(h.database), h.pages, h.restorer, h.database);
});

afterEach(async () => {
  await h.close();
});

describe('trash', () => {
  it('keeps deleted pages and restores them with their blocks and ids', async () => {
    const page = await h.pages.ensure('Reading');
    const root = await h.blocks.create({ pageId: page.id, content: 'root [[Book]]' });
    await h.blocks.create({ pageId: page.id, parentId: root.id, content: 'child' });
    await h.pages.remove(page.id);
    const [item] = await trash.list();
    expect(item).toMatchObject({ kind: 'page', label: 'Reading', blockCount: 2 });

    await trash.restore(item.id);
    const detail = await h.pages.detail('Reading');
    expect(detail.page?.id).toBe(page.id);
    expect(detail.blocks.find((b) => b.id === root.id)?.content).toBe('root [[Book]]');
    expect(detail.blocks.find((b) => b.parentId === root.id)?.content).toBe('child');
    expect((await h.pages.references('Book')).linked).toHaveLength(1);
    expect(await trash.list()).toHaveLength(0);
  });

  it('restores a deleted block subtree under its old parent; skips empty blocks and merges', async () => {
    const page = await h.pages.ensure('Notes');
    const parent = await h.blocks.create({ pageId: page.id, content: 'parent' });
    const gone = await h.blocks.create({ pageId: page.id, parentId: parent.id, content: 'important' });
    await h.blocks.create({ pageId: page.id, parentId: gone.id, content: 'detail' });
    const empty = await h.blocks.create({ pageId: page.id, content: '' });
    const merged = await h.blocks.create({ pageId: page.id, content: 'merged away' });

    await h.blocks.remove(gone.id);
    await h.blocks.remove(empty.id);
    await h.blocks.remove(merged.id, { trash: false });
    const items = await trash.list();
    expect(items.map((i) => i.label)).toEqual(['important']);

    await trash.restore(items[0].id);
    const detail = await h.pages.detail('Notes');
    const restored = detail.blocks.find((b) => b.content === 'important')!;
    expect(restored.parentId).toBe(parent.id);
    expect(detail.blocks.find((b) => b.parentId === restored.id)?.content).toBe('detail');
  });

  it('restores a page under a new title when the old one is taken', async () => {
    const page = await h.pages.ensure('Dup');
    await h.blocks.create({ pageId: page.id, content: 'old' });
    await h.pages.remove(page.id);
    await h.pages.ensure('Dup');
    const [item] = await trash.list();
    const result = await trash.restore(item.id);
    expect(result.pageTitle).toBe('Dup（恢复）');
  });
});
