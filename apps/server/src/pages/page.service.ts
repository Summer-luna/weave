import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { toBlockDto } from '../blocks/block.mapper';
import { containsPattern } from '../common/text-patterns';
import { MAX_TITLE_LENGTH, normalizeTitle, titleKey } from '../common/title';
import { uid } from '../common/uid';
import { LinkParser } from '../links/link-parser';
import { LinkRewriter } from '../links/link-rewriter';
import { BlockRepository } from '../storage/block.repository';
import { DatabaseService } from '../storage/database.service';
import { PageRepository } from '../storage/page.repository';
import { TrashRecorder } from '../trash/trash-recorder';
import { BlockWithPageRow, PageRow } from '../storage/rows';
import { PageDto } from './dto/page.dto';
import { PageDetailDto } from './dto/page-detail.dto';
import { PageSummaryDto } from './dto/page-summary.dto';
import { ReferenceGroupDto } from './dto/reference-group.dto';
import { ReferencesDto } from './dto/references.dto';
import { toPageDto, toPageSummaryDto } from './page.mapper';

const UNLINKED_SCAN_LIMIT = 200;

@Injectable()
export class PageService {
  constructor(
    private readonly pages: PageRepository,
    private readonly blocks: BlockRepository,
    private readonly database: DatabaseService,
    private readonly parser: LinkParser,
    private readonly rewriter: LinkRewriter,
    private readonly trash: TrashRecorder,
  ) {}

  async list(query: string | undefined, starredOnly: boolean, limit: number): Promise<PageSummaryDto[]> {
    const trimmed = query?.trim();
    const rows = await this.pages.list(trimmed ? containsPattern(trimmed) : undefined, starredOnly, limit);
    return rows.map(toPageSummaryDto);
  }

  async ensure(rawTitle: string): Promise<PageDto> {
    return toPageDto(await this.ensureRow(rawTitle));
  }

  async ensureRow(rawTitle: string): Promise<PageRow> {
    const title = this.requireTitle(rawTitle);
    const key = titleKey(title);
    const existing = await this.pages.findByKey(key);
    if (existing) return existing;
    await this.pages.insertIfAbsent({ id: uid(), title, titleKey: key });
    const created = await this.pages.findByKey(key);
    if (!created) throw new Error(`Failed to create page "${title}"`);
    return created;
  }

  async detail(rawTitle: string): Promise<PageDetailDto> {
    const title = this.requireTitle(rawTitle);
    const page = await this.pages.findByKey(titleKey(title));
    if (!page) return { title, page: null, blocks: [] };
    const blocks = await this.blocks.findByPage(page.id);
    return { title: page.title, page: toPageDto(page), blocks: blocks.map(toBlockDto) };
  }

  async references(rawTitle: string): Promise<ReferencesDto> {
    const title = this.requireTitle(rawTitle);
    const page = await this.pages.findByKey(titleKey(title));
    const linked = page ? await this.blocks.findLinkingToPage(page.id) : [];
    const candidates = await this.blocks.findMentioning(containsPattern(title), page?.id ?? null, UNLINKED_SCAN_LIMIT);
    const unlinked = candidates.filter((block) => this.parser.mentions(block.content, title));
    return { linked: await this.group(linked), unlinked: await this.group(unlinked) };
  }

  async rename(id: string, rawTitle: string): Promise<PageDto> {
    const page = await this.requirePage(id);
    const title = this.requireTitle(rawTitle);
    if (title === page.title) return toPageDto(page);
    const key = titleKey(title);
    const clash = await this.pages.findByKey(key);
    if (clash && clash.id !== id) throw new ConflictException(`页面「${clash.title}」已存在`);
    await this.database.transaction(async () => {
      await this.pages.updateTitle(id, title, key);
      for (const block of await this.blocks.findLinkingToPage(id)) {
        const next = this.rewriter.renamePage(block.content, page.title, title);
        if (next !== block.content) await this.blocks.updateContent(block.id, next);
      }
    });
    return toPageDto(await this.requirePage(id));
  }

  async update(id: string, changes: { title?: string; starred?: boolean }): Promise<PageDto> {
    if (changes.title !== undefined) await this.rename(id, changes.title);
    else await this.requirePage(id);
    if (changes.starred !== undefined) await this.pages.setStarred(id, changes.starred);
    return toPageDto(await this.requirePage(id));
  }

  async remove(id: string): Promise<void> {
    const page = await this.requirePage(id);
    await this.database.transaction(async () => {
      await this.trash.recordPage(page, await this.blocks.findByPage(id));
      await this.pages.delete(id);
    });
  }

  private async requirePage(id: string): Promise<PageRow> {
    const page = await this.pages.findById(id);
    if (!page) throw new NotFoundException('页面不存在');
    return page;
  }

  private requireTitle(raw: string): string {
    const title = normalizeTitle(raw ?? '');
    if (!title) throw new BadRequestException('页面标题不能为空');
    if (title.length > MAX_TITLE_LENGTH) throw new BadRequestException('页面标题太长');
    return title;
  }

  async group(rows: BlockWithPageRow[]): Promise<ReferenceGroupDto[]> {
    const groups = new Map<string, ReferenceGroupDto>();
    const breadcrumbs = await this.blocks.ancestorsForMany(rows.map((row) => row.id));
    for (const row of rows) {
      let group = groups.get(row.pageId);
      if (!group) {
        group = { pageId: row.pageId, pageTitle: row.pageTitle, items: [] };
        groups.set(row.pageId, group);
      }
      group.items.push({ block: toBlockDto(row), breadcrumbs: breadcrumbs.get(row.id) ?? [] });
    }
    return [...groups.values()];
  }
}
