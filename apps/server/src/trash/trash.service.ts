import { Injectable, NotFoundException } from '@nestjs/common';
import { OutlineRestorer } from '../blocks/outline-restorer';
import { titleKey } from '../common/title';
import { uid } from '../common/uid';
import { PageService } from '../pages/page.service';
import { BlockRepository } from '../storage/block.repository';
import { DatabaseService } from '../storage/database.service';
import { PageRepository } from '../storage/page.repository';
import { TrashRow } from '../storage/rows';
import { TrashRepository } from '../storage/trash.repository';
import { RestoreResultDto } from './dto/restore-result.dto';
import { TrashItemDto } from './dto/trash-item.dto';

@Injectable()
export class TrashService {
  constructor(
    private readonly trash: TrashRepository,
    private readonly pages: PageRepository,
    private readonly blocks: BlockRepository,
    private readonly pageService: PageService,
    private readonly restorer: OutlineRestorer,
    private readonly database: DatabaseService,
  ) {}

  async list(limit = 200): Promise<TrashItemDto[]> {
    return (await this.trash.list(limit)).map((row) => this.toDto(row));
  }

  async describe(id: string): Promise<TrashItemDto> {
    const entry = await this.trash.find(id);
    if (!entry) throw new NotFoundException('回收站里没有这一项');
    return this.toDto(entry);
  }

  async restore(id: string): Promise<RestoreResultDto> {
    const entry = await this.trash.find(id);
    if (!entry) throw new NotFoundException('回收站里没有这一项');
    const { payload } = entry;
    const result = await this.database.transaction(async () => {
      if (entry.kind === 'page') {
        const title = await this.freeTitle(payload.pageTitle);
        const pageId = (await this.pages.findById(payload.pageId)) ? uid() : payload.pageId;
        await this.pages.insertIfAbsent({ id: pageId, title, titleKey: titleKey(title), starred: payload.starred ?? false });
        await this.restorer.restorePage(pageId, payload.blocks);
        return { pageTitle: title };
      }
      const page = (await this.pages.findById(payload.pageId)) ?? (await this.pageService.ensureRow(payload.pageTitle));
      const root = payload.root ?? { parentId: null, position: 0 };
      const parent = root.parentId ? await this.blocks.findById(root.parentId) : undefined;
      const parentId = parent && parent.pageId === page.id ? parent.id : null;
      const blockId = await this.restorer.insertSubtree(page.id, parentId, root.position, payload.blocks);
      return { pageTitle: page.title, blockId };
    });
    await this.trash.delete(id);
    return result;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.trash.delete(id))) throw new NotFoundException('回收站里没有这一项');
  }

  clear(): Promise<void> {
    return this.trash.clear();
  }

  private toDto(row: TrashRow): TrashItemDto {
    return {
      id: row.id,
      kind: row.kind,
      label: row.label,
      pageTitle: row.pageTitle,
      blockCount: row.payload.blocks.length,
      deletedAt: row.deletedAt.toISOString(),
    };
  }

  private async freeTitle(title: string): Promise<string> {
    if (!(await this.pages.findByKey(titleKey(title)))) return title;
    for (let n = 1; ; n++) {
      const candidate = `${title}（恢复${n > 1 ? n : ''}）`;
      if (!(await this.pages.findByKey(titleKey(candidate)))) return candidate;
    }
  }
}
