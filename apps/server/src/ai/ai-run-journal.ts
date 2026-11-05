import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BlockService } from '../blocks/block.service';
import { OutlineRestorer, RestorableBlock } from '../blocks/outline-restorer';
import { titleKey } from '../common/title';
import { PageService } from '../pages/page.service';
import { DatabaseService } from '../storage/database.service';
import { PageRepository } from '../storage/page.repository';
import { TrashService } from '../trash/trash.service';
import { NOTE_TOOL_SPECS } from './note-tool-specs';

interface PageSnapshot {
  pageId: string | null;
  title: string;
  starred: boolean;
  blocks: RestorableBlock[];
}

interface RunRecord {
  snapshots: Map<string, PageSnapshot>;
  expiresAt: number;
  undone: boolean;
}

const RUN_TTL_MS = 24 * 60 * 60_000;

/** Remembers how every page an AI run touched looked before its first change, so the whole run can be undone. */
@Injectable()
export class AiRunJournal {
  private readonly runs = new Map<string, RunRecord>();

  constructor(
    private readonly pages: PageService,
    private readonly pageRepository: PageRepository,
    private readonly blocks: BlockService,
    private readonly restorer: OutlineRestorer,
    private readonly database: DatabaseService,
    private readonly trash: TrashService,
  ) {}

  async beforeTool(runId: string, tool: string, input: Record<string, any>): Promise<void> {
    if (NOTE_TOOL_SPECS.find((spec) => spec.name === tool)?.readOnly) return;
    for (const title of await this.affectedTitles(tool, input)) await this.capture(runId, title);
  }

  /** Pages a tool created under a title that could not be predicted beforehand are removed again on undo. */
  afterTool(runId: string, createdPages: string[] = []): void {
    const run = this.runs.get(runId);
    for (const title of createdPages) {
      const key = titleKey(title);
      if (run && !run.snapshots.has(key)) run.snapshots.set(key, { pageId: null, title, starred: false, blocks: [] });
    }
  }

  hasChanges(runId: string): boolean {
    return (this.runs.get(runId)?.snapshots.size ?? 0) > 0;
  }

  async undo(runId: string): Promise<{ pages: string[] }> {
    const run = this.runs.get(runId);
    if (!run || run.expiresAt < Date.now()) throw new NotFoundException('找不到这次 AI 操作的记录（可能已超过 24 小时或服务重启过）');
    if (run.undone) throw new BadRequestException('这次 AI 的改动已经撤销过了');
    const restored: string[] = [];
    await this.database.transaction(async () => {
      for (const snapshot of run.snapshots.values()) {
        if (!snapshot.pageId) {
          const created = await this.pageRepository.findByKey(titleKey(snapshot.title));
          if (created) await this.pages.remove(created.id);
          restored.push(snapshot.title);
          continue;
        }
        let page = await this.pageRepository.findById(snapshot.pageId);
        if (!page) {
          await this.pageRepository.insertIfAbsent({ id: snapshot.pageId, title: snapshot.title, titleKey: titleKey(snapshot.title), starred: snapshot.starred });
          page = await this.pageRepository.findById(snapshot.pageId);
        }
        if (!page) continue;
        if (page.title !== snapshot.title || page.starred !== snapshot.starred) {
          await this.pages.update(page.id, { title: snapshot.title, starred: snapshot.starred });
        }
        await this.restorer.restorePage(page.id, snapshot.blocks);
        restored.push(snapshot.title);
      }
    });
    run.undone = true;
    return { pages: restored };
  }

  private async capture(runId: string, title: string): Promise<void> {
    const run = this.run(runId);
    const key = titleKey(title);
    if (run.snapshots.has(key)) return;
    const detail = await this.pages.detail(title);
    run.snapshots.set(key, {
      pageId: detail.page?.id ?? null,
      title: detail.title,
      starred: detail.page?.starred ?? false,
      blocks: detail.blocks.map(({ id, parentId, position, content, open }) => ({ id, parentId, position, content, open })),
    });
  }

  private async affectedTitles(tool: string, input: Record<string, any>): Promise<string[]> {
    const titlesOfBlocks = async (ids: string[]) => (await this.blocks.getMany(ids)).map((b) => b.pageTitle);
    switch (tool) {
      case 'update_block':
      case 'move_block':
      case 'delete_block':
      case 'set_todo':
      case 'set_block_collapsed':
        return titlesOfBlocks([input.id]);
      case 'insert_blocks':
      case 'apply_template':
        return [input.page_title];
      case 'restore_from_trash':
        return [(await this.trash.describe(input.id)).pageTitle];
      case 'rename_page':
        return [input.title, input.new_title];
      case 'link_unlinked_mentions': {
        const refs = await this.pages.references(input.title);
        const ids = refs.unlinked.flatMap((g) => g.items.map((i) => i.block.id));
        const wanted = input.block_ids?.length ? ids.filter((id) => input.block_ids.includes(id)) : ids;
        return titlesOfBlocks(wanted);
      }
      default:
        return input.title ? [input.title] : [];
    }
  }

  private run(runId: string): RunRecord {
    let run = this.runs.get(runId);
    if (!run) {
      for (const [id, old] of this.runs) if (old.expiresAt < Date.now()) this.runs.delete(id);
      run = { snapshots: new Map(), expiresAt: Date.now() + RUN_TTL_MS, undone: false };
      this.runs.set(runId, run);
    }
    return run;
  }
}
