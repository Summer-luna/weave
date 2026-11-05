import { Injectable } from '@nestjs/common';
import { uid } from '../common/uid';
import { BlockRow, PageRow } from '../storage/rows';
import { TrashRepository } from '../storage/trash.repository';
import { TrashedBlock } from './trash-payload';

const LABEL_LENGTH = 80;

@Injectable()
export class TrashRecorder {
  constructor(private readonly trash: TrashRepository) {}

  async recordPage(page: PageRow, blocks: BlockRow[]): Promise<void> {
    await this.trash.insert({
      id: uid(),
      kind: 'page',
      label: page.title,
      pageTitle: page.title,
      payload: { pageId: page.id, pageTitle: page.title, starred: page.starred, blocks: blocks.map(this.toTrashed) },
    });
  }

  /** Records a deleted block subtree; empty blocks are not worth a trash entry. */
  async recordBlocks(page: PageRow, root: BlockRow, subtree: BlockRow[]): Promise<void> {
    if (subtree.every((block) => !block.content.trim())) return;
    const label = (root.content.trim() || subtree.find((b) => b.content.trim())?.content || '').replace(/\s+/g, ' ');
    await this.trash.insert({
      id: uid(),
      kind: 'block',
      label: label.length > LABEL_LENGTH ? `${label.slice(0, LABEL_LENGTH)}…` : label,
      pageTitle: page.title,
      payload: {
        pageId: page.id,
        pageTitle: page.title,
        root: { parentId: root.parentId, position: root.position },
        blocks: subtree.map(this.toTrashed),
      },
    });
  }

  private toTrashed(block: BlockRow): TrashedBlock {
    return { id: block.id, parentId: block.parentId, position: block.position, content: block.content, open: block.open };
  }
}
