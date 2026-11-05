import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BlockService } from '../blocks/block.service';
import { BlockDto } from '../blocks/dto/block.dto';
import { PageService } from '../pages/page.service';
import { ReferenceGroupDto } from '../pages/dto/reference-group.dto';
import { TrashService } from '../trash/trash.service';

export interface ToolkitResult {
  output: unknown;
  mutated: boolean;
  /** Pages that did not exist before this tool ran and whose titles were only known afterwards. */
  createdPages?: string[];
}

const TAG_BLOCK_PREFIX = '标签：';
const TAG_SAFE = /^[\p{L}\p{N}_\-/]+$/u;
const MAX_OUTLINE_CHARS = 40_000;
const TODO_PREFIX = /^\[( |x|X)\] /;
const TEMPLATE_PREFIX = '模板/';
const DAILY_TITLE = /^\d{4}-\d{2}-\d{2}$/;

type NewBlock = { content: string; children?: NewBlock[] };

@Injectable()
export class NoteToolkit {
  constructor(
    private readonly pages: PageService,
    private readonly blocks: BlockService,
    private readonly trash: TrashService,
  ) {}

  async execute(name: string, input: Record<string, any>): Promise<ToolkitResult> {
    switch (name) {
      case 'search_pages':
        return this.read(
          (await this.pages.list(input.query || undefined, input.starred_only ?? false, input.limit ?? 20)).map((p) => ({
            title: p.title,
            blocks: p.blockCount,
            references: p.refCount,
            starred: p.starred,
          })),
        );
      case 'search_notes':
        return this.read(
          (await this.blocks.searchNotes(input.keywords, input.limit ?? 40)).map((hit) => ({
            id: hit.id,
            page: hit.pageTitle,
            context: hit.breadcrumbs.join(' › ') || undefined,
            content: hit.content,
            matched: hit.matched,
          })),
        );
      case 'search_blocks':
        return this.read(
          (await this.blocks.search(input.query, input.limit ?? 20)).map((b) => ({ id: b.id, page: b.pageTitle, content: b.content })),
        );
      case 'read_page':
        return this.read(await this.readPage(input.title));
      case 'read_block':
        return this.read(await this.readBlock(input.id));
      case 'get_block_references':
        return this.read(
          (await this.blocks.references(input.id)).map((g) => ({
            page: g.pageTitle,
            blocks: g.items.map((item) => ({ id: item.block.id, content: item.block.content })),
          })),
        );
      case 'list_daily_notes':
        return this.read(
          (await this.pages.list(input.month, false, 1000))
            .filter((p) => DAILY_TITLE.test(p.title) && p.title.startsWith(input.month) && p.blockCount > 0)
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((p) => ({ title: p.title, blocks: p.blockCount })),
        );
      case 'list_templates':
        return this.read(
          (await this.pages.list(TEMPLATE_PREFIX, false, 200))
            .filter((p) => p.title.startsWith(TEMPLATE_PREFIX))
            .map((p) => ({ title: p.title, blocks: p.blockCount })),
        );
      case 'create_page':
        return this.write(await this.pages.ensure(input.title));
      case 'apply_template':
        return this.write(await this.applyTemplate(input.template_title, input.page_title, input.parent_id ?? null, input.index));
      case 'set_todo':
        return this.write(await this.setTodo(input.id, input.state));
      case 'set_block_collapsed': {
        const block = await this.blocks.update(input.id, { open: !input.collapsed });
        return this.write({ id: block.id, collapsed: !block.open });
      }
      case 'insert_blocks':
        return this.write(await this.insertBlocks(input.page_title, input.parent_id ?? null, input.index, input.blocks));
      case 'update_block': {
        const block = await this.blocks.update(input.id, { content: input.content });
        return this.write({ id: block.id, content: block.content });
      }
      case 'move_block': {
        const block = await this.blocks.move(input.id, { parentId: input.parent_id, index: input.index });
        return this.write({ id: block.id, parentId: block.parentId, position: block.position });
      }
      case 'delete_block':
        await this.blocks.remove(input.id);
        return this.write({ deleted: input.id });
      case 'rename_page': {
        const page = await this.requirePage(input.title);
        return this.write(await this.pages.update(page.id, { title: input.new_title }));
      }
      case 'delete_page': {
        const page = await this.requirePage(input.title);
        await this.pages.remove(page.id);
        return this.write({ deleted: page.title });
      }
      case 'set_page_starred': {
        const page = await this.pages.ensure(input.title);
        return this.write(await this.pages.update(page.id, { starred: input.starred }));
      }
      case 'add_page_tags':
        return this.write(await this.addTags(input.title, input.tags));
      case 'link_unlinked_mentions':
        return this.write(await this.linkMentions(input.title, input.block_ids));
      case 'list_trash':
        return this.read(await this.trash.list(input.limit ?? 50));
      case 'restore_from_trash': {
        const restored = await this.trash.restore(input.id);
        return { output: restored, mutated: true, createdPages: [restored.pageTitle] };
      }
      case 'delete_from_trash':
        await this.trash.remove(input.id);
        return this.write({ deleted: input.id });
      case 'empty_trash':
        await this.trash.clear();
        return this.write({ emptied: true });
      default:
        throw new BadRequestException(`未知工具：${name}`);
    }
  }

  private read(output: unknown): ToolkitResult {
    return { output, mutated: false };
  }

  private write(output: unknown): ToolkitResult {
    return { output, mutated: true };
  }

  private async requirePage(title: string) {
    const detail = await this.pages.detail(title);
    if (!detail.page) throw new NotFoundException(`页面「${title}」不存在`);
    return detail.page;
  }

  private async readPage(title: string): Promise<string> {
    const detail = await this.pages.detail(title);
    const refs = await this.pages.references(title);
    const lines = [`# ${detail.title}${detail.page ? '' : '（页面尚不存在）'}`];
    lines.push(...this.outlineLines(detail.blocks, null, 0));
    if (detail.blocks.length === 0) lines.push('（没有内容）');
    lines.push('', ...this.referenceLines('Linked references', refs.linked), '', ...this.referenceLines('Unlinked mentions', refs.unlinked));
    const text = lines.join('\n');
    return text.length > MAX_OUTLINE_CHARS ? `${text.slice(0, MAX_OUTLINE_CHARS)}\n…（已截断）` : text;
  }

  private async readBlock(id: string): Promise<string> {
    const block = await this.blocks.get(id);
    const [ref] = await this.blocks.getMany([id]);
    const detail = await this.pages.detail(ref.pageTitle);
    const crumbs = await this.blocks.breadcrumbs(id);
    const lines = [`Page: ${ref.pageTitle}`];
    if (crumbs.length) lines.push(`Ancestors: ${crumbs.map((c) => `[${c.id}] ${c.content}`).join(' › ')}`);
    lines.push(`- [${block.id}] ${block.content}`, ...this.outlineLines(detail.blocks, block.id, 1));
    return lines.join('\n');
  }

  private outlineLines(blocks: BlockDto[], parentId: string | null, depth: number): string[] {
    return blocks
      .filter((b) => b.parentId === parentId)
      .sort((a, b) => a.position - b.position)
      .flatMap((b) => [`${'  '.repeat(depth)}- [${b.id}] ${b.content.replace(/\n/g, ' ⏎ ')}`, ...this.outlineLines(blocks, b.id, depth + 1)]);
  }

  private referenceLines(heading: string, groups: ReferenceGroupDto[]): string[] {
    const items = groups.flatMap((g) => g.items.map((item) => `- from [[${g.pageTitle}]] [${item.block.id}] ${item.block.content}`));
    return [`## ${heading} (${items.length})`, ...items.slice(0, 100)];
  }

  private async insertBlocks(pageTitle: string, parentId: string | null, index: number | undefined, blocks: NewBlock[]) {
    const page = await this.pages.ensure(pageTitle);
    const created: { id: string; content: string }[] = [];
    const insert = async (items: NewBlock[], parent: string | null, start: number | undefined) => {
      for (const [offset, item] of items.entries()) {
        const block = await this.blocks.create({
          pageId: page.id,
          parentId: parent,
          index: start === undefined ? undefined : start + offset,
          content: item.content,
        });
        created.push({ id: block.id, content: block.content });
        if (item.children?.length) await insert(item.children, block.id, undefined);
      }
    };
    await insert(blocks, parentId, index);
    return { page: page.title, created };
  }

  private async applyTemplate(templateTitle: string, pageTitle: string, parentId: string | null, index: number | undefined) {
    const template = await this.pages.detail(templateTitle);
    if (!template.page) throw new NotFoundException(`模板「${templateTitle}」不存在`);
    if (template.blocks.length === 0) throw new BadRequestException(`模板「${templateTitle}」是空的`);
    const tree = (parent: string | null): NewBlock[] =>
      template.blocks
        .filter((b) => b.parentId === parent)
        .sort((a, b) => a.position - b.position)
        .map((b) => ({ content: b.content, children: tree(b.id) }));
    return this.insertBlocks(pageTitle, parentId, index, tree(null));
  }

  private async setTodo(id: string, state: 'todo' | 'done' | 'none') {
    const block = await this.blocks.get(id);
    const text = block.content.replace(TODO_PREFIX, '');
    const content = state === 'todo' ? `[ ] ${text}` : state === 'done' ? `[x] ${text}` : text;
    const updated = content === block.content ? block : await this.blocks.update(id, { content });
    return { id: updated.id, content: updated.content };
  }

  private async addTags(title: string, tags: string[]) {
    const page = await this.pages.ensure(title);
    const detail = await this.pages.detail(page.title);
    const existing = detail.blocks.find((b) => b.parentId === null && b.content.startsWith(TAG_BLOCK_PREFIX));
    const format = (tag: string) => {
      const clean = tag.trim().replace(/^#/, '').replace(/^\[\[(.*)\]\]$/, '$1');
      return TAG_SAFE.test(clean) ? `#${clean}` : `#[[${clean}]]`;
    };
    const current = existing ? existing.content.slice(TAG_BLOCK_PREFIX.length).split(/\s+/).filter(Boolean) : [];
    const merged = [...current];
    for (const tag of tags.map(format)) if (!merged.some((t) => t.toLowerCase() === tag.toLowerCase())) merged.push(tag);
    const content = `${TAG_BLOCK_PREFIX}${merged.join(' ')}`;
    const block = existing
      ? await this.blocks.update(existing.id, { content })
      : await this.blocks.create({ pageId: page.id, parentId: null, index: 0, content });
    return { page: page.title, block: block.id, tags: merged };
  }

  private async linkMentions(title: string, blockIds?: string[]) {
    const refs = await this.pages.references(title);
    const candidates = refs.unlinked.flatMap((g) => g.items.map((item) => item.block.id));
    const targets = blockIds?.length ? candidates.filter((id) => blockIds.includes(id)) : candidates;
    const linked: string[] = [];
    for (const id of targets) {
      await this.blocks.linkMention(id, title);
      linked.push(id);
    }
    return { title, linked, skipped: (blockIds ?? []).filter((id) => !linked.includes(id)) };
  }
}
