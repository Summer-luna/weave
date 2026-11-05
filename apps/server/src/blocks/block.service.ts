import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { clamp, containsPattern } from '../common/text-patterns';
import { uid } from '../common/uid';
import { LinkParser } from '../links/link-parser';
import { LinkRewriter } from '../links/link-rewriter';
import { ReferenceGroupDto } from '../pages/dto/reference-group.dto';
import { PageService } from '../pages/page.service';
import { BlockRepository } from '../storage/block.repository';
import { DatabaseService } from '../storage/database.service';
import { LinkRepository } from '../storage/link.repository';
import { PageRepository } from '../storage/page.repository';
import { BlockWithRefsRow } from '../storage/rows';
import { TrashRecorder } from '../trash/trash-recorder';
import { toBlockDto, toBlockRefDto } from './block.mapper';
import { BlockDto } from './dto/block.dto';
import { BlockRefDto } from './dto/block-ref.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { MoveBlockDto } from './dto/move-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

const MAX_BATCH = 200;

export type NoteSearchHit = BlockRefDto & { matched: number; breadcrumbs: string[] };

@Injectable()
export class BlockService {
  constructor(
    private readonly blocks: BlockRepository,
    private readonly pages: PageRepository,
    private readonly links: LinkRepository,
    private readonly pageService: PageService,
    private readonly parser: LinkParser,
    private readonly rewriter: LinkRewriter,
    private readonly database: DatabaseService,
    private readonly trash: TrashRecorder,
  ) {}

  async get(id: string): Promise<BlockDto> {
    return toBlockDto(await this.requireBlock(id));
  }

  async references(id: string): Promise<ReferenceGroupDto[]> {
    return this.pageService.group(await this.blocks.findReferencingBlock(id));
  }

  async breadcrumbs(id: string): Promise<{ id: string; content: string }[]> {
    await this.requireBlock(id);
    return this.blocks.ancestors(id);
  }

  async getMany(ids: string[]): Promise<BlockRefDto[]> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_BATCH);
    const rows = await this.blocks.findWithPageByIds(unique);
    return rows.map(toBlockRefDto);
  }

  async search(query: string, limit: number): Promise<BlockRefDto[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const rows = await this.blocks.search(containsPattern(trimmed), limit);
    return rows.map(toBlockRefDto);
  }

  async searchNotes(keywords: string[], limit: number): Promise<NoteSearchHit[]> {
    const terms = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 12);
    if (terms.length === 0) return [];
    const rows = await this.blocks.searchAny(terms.map(containsPattern), limit);
    const crumbs = await this.blocks.ancestorsForMany(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...toBlockRefDto(row),
      matched: row.hits,
      breadcrumbs: (crumbs.get(row.id) ?? []).map((crumb) => crumb.content),
    }));
  }

  async create(input: CreateBlockDto): Promise<BlockDto> {
    const page = await this.pages.findById(input.pageId);
    if (!page) throw new NotFoundException('页面不存在');
    const id = input.id ?? uid();
    if (await this.blocks.findById(id)) throw new ConflictException('块 id 已存在');
    const parentId = input.parentId ?? null;
    if (parentId) await this.requireParentOnPage(parentId, page.id);
    const content = input.content ?? '';
    await this.database.transaction(async () => {
      const count = await this.blocks.siblingCount(page.id, parentId);
      const index = clamp(input.index ?? count, 0, count);
      await this.blocks.shiftPositions(page.id, parentId, index, 1);
      await this.blocks.insert({ id, pageId: page.id, parentId, position: index, content });
      await this.syncLinks(id, content);
      await this.pages.touch(page.id);
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateBlockDto): Promise<BlockDto> {
    const block = await this.requireBlock(id);
    await this.database.transaction(async () => {
      if (input.content !== undefined && input.content !== block.content) {
        await this.blocks.updateContent(id, input.content);
        await this.syncLinks(id, input.content);
        await this.pages.touch(block.pageId);
      }
      if (input.open !== undefined && input.open !== block.open) await this.blocks.updateOpen(id, input.open);
    });
    return this.get(id);
  }

  async move(id: string, input: MoveBlockDto): Promise<BlockDto> {
    const block = await this.requireBlock(id);
    const parentId = input.parentId ?? null;
    if (parentId) {
      if (parentId === id) throw new BadRequestException('不能把块移动到自己下面');
      await this.requireParentOnPage(parentId, block.pageId);
      if (await this.blocks.isAncestor(id, parentId)) throw new BadRequestException('不能把块移动到自己的子块下面');
    }
    await this.database.transaction(async () => {
      await this.blocks.shiftPositions(block.pageId, block.parentId, block.position + 1, -1, id);
      const count = await this.blocks.siblingCount(block.pageId, parentId, id);
      const index = clamp(input.index, 0, count);
      await this.blocks.shiftPositions(block.pageId, parentId, index, 1, id);
      await this.blocks.place(id, parentId, index);
      await this.pages.touch(block.pageId);
    });
    return this.get(id);
  }

  async remove(id: string, options: { trash?: boolean } = {}): Promise<void> {
    const block = await this.requireBlock(id);
    await this.database.transaction(async () => {
      const subtreeIds = await this.blocks.subtreeIds(id);
      if (options.trash !== false) {
        const page = await this.pages.findById(block.pageId);
        const pageBlocks = await this.blocks.findByPage(block.pageId);
        const subtree = subtreeIds.map((sid) => pageBlocks.find((b) => b.id === sid)).filter((b) => b !== undefined);
        if (page) await this.trash.recordBlocks(page, block, subtree);
      }
      const linkedBefore = await this.links.linkedPageIds(subtreeIds);
      await this.blocks.delete(id);
      await this.blocks.shiftPositions(block.pageId, block.parentId, block.position + 1, -1);
      await this.pages.touch(block.pageId);
      await this.pages.deleteOrphans(linkedBefore.filter((pageId) => pageId !== block.pageId));
    });
  }

  async linkMention(id: string, title: string): Promise<BlockDto> {
    const block = await this.requireBlock(id);
    const next = this.rewriter.linkMention(block.content, title);
    if (next === block.content) throw new BadRequestException('块内容里没有找到这个标题');
    return this.update(id, { content: next });
  }

  private async syncLinks(blockId: string, content: string): Promise<void> {
    const parsed = this.parser.parse(content);
    const linkedBefore = await this.links.linkedPageIds([blockId]);
    const pageIds: string[] = [];
    for (const title of parsed.pageTitles) pageIds.push((await this.pageService.ensureRow(title)).id);
    await this.links.replacePageLinks(blockId, pageIds);
    // Typing "[[Dee" on the way to "[[Deep Work]]" creates throwaway pages; drop them once nothing uses them.
    await this.pages.deleteOrphans(linkedBefore.filter((pageId) => !pageIds.includes(pageId)));
    await this.links.replaceBlockRefs(
      blockId,
      parsed.blockRefs.filter((ref) => ref !== blockId),
    );
  }

  private async requireBlock(id: string): Promise<BlockWithRefsRow> {
    const block = await this.blocks.findById(id);
    if (!block) throw new NotFoundException('块不存在');
    return block;
  }

  private async requireParentOnPage(parentId: string, pageId: string): Promise<void> {
    const parent = await this.blocks.findById(parentId);
    if (!parent || parent.pageId !== pageId) throw new BadRequestException('父块不存在或不在同一页面');
  }
}
