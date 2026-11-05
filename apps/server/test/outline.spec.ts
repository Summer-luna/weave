import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, Harness } from './harness';

let h: Harness;

beforeEach(async () => {
  h = await createHarness();
});

afterEach(async () => {
  await h.close();
});

async function outline(title: string) {
  const detail = await h.pages.detail(title);
  const render = (parentId: string | null): unknown[] =>
    detail.blocks
      .filter((b) => b.parentId === parentId)
      .sort((a, b) => a.position - b.position)
      .map((b) => {
        const children = render(b.id);
        return children.length ? [b.content, children] : b.content;
      });
  return render(null);
}

describe('block tree', () => {
  it('inserts, moves and deletes blocks keeping sibling positions dense', async () => {
    const page = await h.pages.ensure('Inbox');
    const a = await h.blocks.create({ pageId: page.id, content: 'a' });
    const c = await h.blocks.create({ pageId: page.id, content: 'c' });
    const b = await h.blocks.create({ pageId: page.id, content: 'b', index: 1 });
    expect(await outline('Inbox')).toEqual(['a', 'b', 'c']);

    await h.blocks.move(b.id, { parentId: a.id, index: 0 });
    await h.blocks.move(c.id, { parentId: a.id, index: 0 });
    expect(await outline('Inbox')).toEqual([['a', ['c', 'b']]]);

    await h.blocks.move(b.id, { parentId: null, index: 5 });
    expect(await outline('Inbox')).toEqual([['a', ['c']], 'b']);

    await h.blocks.move(b.id, { parentId: null, index: 0 });
    expect(await outline('Inbox')).toEqual(['b', ['a', ['c']]]);

    await h.blocks.remove(a.id);
    expect(await outline('Inbox')).toEqual(['b']);
    const detail = await h.pages.detail('Inbox');
    expect(detail.blocks.map((x) => x.position)).toEqual([0]);
  });

  it('lists pages with block and reference counts', async () => {
    const page = await h.pages.ensure('Counted');
    await h.blocks.create({ pageId: page.id, content: 'one [[Target]]' });
    await h.blocks.create({ pageId: page.id, content: 'two' });
    const list = await h.pages.list(undefined, false, 10);
    const byTitle = Object.fromEntries(list.map((p) => [p.title, p]));
    expect(byTitle.Counted.blockCount).toBe(2);
    expect(byTitle.Target.refCount).toBe(1);
    expect(byTitle.Target.blockCount).toBe(0);
  });

  it('refuses to move a block under its own descendant', async () => {
    const page = await h.pages.ensure('Tree');
    const parent = await h.blocks.create({ pageId: page.id, content: 'parent' });
    const child = await h.blocks.create({ pageId: page.id, parentId: parent.id, content: 'child' });
    await expect(h.blocks.move(parent.id, { parentId: child.id, index: 0 })).rejects.toThrow();
  });
});

describe('links and references', () => {
  it('creates linked pages, reports backlinks with breadcrumbs, and unlinked mentions', async () => {
    const journal = await h.pages.ensure('2026-11-05');
    const parent = await h.blocks.create({ pageId: journal.id, content: '读书笔记' });
    await h.blocks.create({ pageId: journal.id, parentId: parent.id, content: '今天读 [[深度工作]] #focus' });
    const other = await h.pages.ensure('Ideas');
    const mention = await h.blocks.create({ pageId: other.id, content: '深度工作 很重要' });

    const deep = await h.pages.detail('深度工作');
    expect(deep.page).not.toBeNull();
    expect((await h.pages.detail('FOCUS')).page?.title).toBe('focus');

    const refs = await h.pages.references('深度工作');
    expect(refs.linked).toHaveLength(1);
    expect(refs.linked[0].pageTitle).toBe('2026-11-05');
    expect(refs.linked[0].items[0].breadcrumbs.map((b) => b.content)).toEqual(['读书笔记']);
    expect(refs.unlinked.map((g) => g.items[0].block.id)).toEqual([mention.id]);

    await h.blocks.linkMention(mention.id, '深度工作');
    const after = await h.pages.references('深度工作');
    expect(after.linked).toHaveLength(2);
    expect(after.unlinked).toHaveLength(0);
  });

  it('removes links when content changes and counts block refs', async () => {
    const page = await h.pages.ensure('Notes');
    const target = await h.blocks.create({ pageId: page.id, content: 'a quotable idea' });
    const linker = await h.blocks.create({ pageId: page.id, content: `see ((${target.id})) and [[Topic]]` });
    expect((await h.blocks.get(target.id)).refCount).toBe(1);
    expect((await h.pages.references('Topic')).linked).toHaveLength(1);
    const [group] = await h.blocks.references(target.id);
    expect(group.pageTitle).toBe('Notes');
    expect(group.items.map((item) => item.block.id)).toEqual([linker.id]);

    await h.blocks.update(linker.id, { content: 'nothing now' });
    expect((await h.blocks.get(target.id)).refCount).toBe(0);
    expect((await h.pages.references('Topic')).linked).toHaveLength(0);

    const [ref] = await h.blocks.getMany([target.id]);
    expect(ref.pageTitle).toBe('Notes');
  });

  it('renames a page and rewrites every link to it', async () => {
    const page = await h.pages.ensure('Journal');
    const block = await h.blocks.create({ pageId: page.id, content: 'met [[Bob]] about #bob' });
    const bob = (await h.pages.detail('Bob')).page!;
    await h.pages.rename(bob.id, 'Robert Smith');
    expect((await h.blocks.get(block.id)).content).toBe('met [[Robert Smith]] about #[[Robert Smith]]');
    expect((await h.pages.detail('bob')).page).toBeNull();
    expect((await h.pages.references('Robert Smith')).linked).toHaveLength(1);

    await h.pages.ensure('Alice');
    await expect(h.pages.rename(bob.id, 'alice')).rejects.toThrow();
  });
});

describe('starred pages', () => {
  it('stars pages and lists only starred ones alphabetically', async () => {
    const b = await h.pages.ensure('Beta');
    const a = await h.pages.ensure('alpha');
    await h.pages.ensure('Gamma');
    await h.pages.update(b.id, { starred: true });
    const updated = await h.pages.update(a.id, { starred: true });
    expect(updated.starred).toBe(true);
    expect((await h.pages.list(undefined, true, 10)).map((p) => p.title)).toEqual(['alpha', 'Beta']);
  });
});

describe('orphan pages', () => {
  it('removes pages that only existed because of a half-typed link', async () => {
    const page = await h.pages.ensure('Inbox');
    const block = await h.blocks.create({ pageId: page.id, content: 'see [[Dee]]' });
    expect((await h.pages.detail('Dee')).page).not.toBeNull();
    await h.blocks.update(block.id, { content: 'see [[Deep Work]]' });
    expect((await h.pages.detail('Dee')).page).toBeNull();
    expect((await h.pages.detail('Deep Work')).page).not.toBeNull();
  });

  it('keeps linked pages that have their own content or are starred', async () => {
    const page = await h.pages.ensure('Inbox');
    const block = await h.blocks.create({ pageId: page.id, content: '[[Kept]] [[Starred]] [[Gone]]' });
    const kept = (await h.pages.detail('Kept')).page!;
    await h.blocks.create({ pageId: kept.id, content: 'own content' });
    const starred = (await h.pages.detail('Starred')).page!;
    await h.pages.update(starred.id, { starred: true });
    await h.blocks.remove(block.id);
    expect((await h.pages.detail('Kept')).page).not.toBeNull();
    expect((await h.pages.detail('Starred')).page).not.toBeNull();
    expect((await h.pages.detail('Gone')).page).toBeNull();
  });
});
