import { Injectable } from '@nestjs/common';
import { BlockRepository } from '../storage/block.repository';
import { BlockService } from './block.service';

export interface RestorableBlock {
  id: string;
  parentId: string | null;
  position: number;
  content: string;
  open: boolean;
}

@Injectable()
export class OutlineRestorer {
  constructor(
    private readonly blocks: BlockService,
    private readonly repository: BlockRepository,
  ) {}

  /** Makes a page's blocks match `target` exactly (same ids, nesting, order, content). */
  async restorePage(pageId: string, target: RestorableBlock[]): Promise<void> {
    const ordered = this.preorder(target);
    const wanted = new Set(target.map((b) => b.id));
    let current = await this.repository.findByPage(pageId);
    const existing = new Set(current.map((b) => b.id));

    for (const block of ordered) {
      if (existing.has(block.id)) continue;
      if (await this.repository.findById(block.id)) continue;
      await this.blocks.create({ id: block.id, pageId, parentId: block.parentId, index: block.position, content: block.content });
    }

    for (const block of ordered) {
      if (!(await this.repository.findById(block.id))) continue;
      await this.blocks.move(block.id, { parentId: block.parentId, index: block.position });
    }

    current = await this.repository.findByPage(pageId);
    const extra = current.filter((b) => !wanted.has(b.id));
    for (const block of extra) {
      if (block.parentId && extra.some((e) => e.id === block.parentId)) continue;
      if (await this.repository.findById(block.id)) await this.blocks.remove(block.id, { trash: false });
    }

    for (const block of target) {
      const now = await this.repository.findById(block.id);
      if (!now) continue;
      if (now.content !== block.content || now.open !== block.open) await this.blocks.update(block.id, { content: block.content, open: block.open });
    }
  }

  /** Re-inserts a deleted subtree, reusing ids when they are free. Returns the new root id. */
  async insertSubtree(pageId: string, rootParentId: string | null, rootIndex: number, subtree: RestorableBlock[]): Promise<string> {
    const rootId = subtree.find((b) => !subtree.some((p) => p.id === b.parentId))!.id;
    const ids = new Map<string, string>();
    for (const block of this.preorder(subtree)) {
      const free = !(await this.repository.findById(block.id));
      const isRoot = block.id === rootId;
      const created = await this.blocks.create({
        id: free ? block.id : undefined,
        pageId,
        parentId: isRoot ? rootParentId : ids.get(block.parentId!)!,
        index: isRoot ? rootIndex : block.position,
        content: block.content,
      });
      ids.set(block.id, created.id);
      if (!block.open) await this.blocks.update(created.id, { open: false });
    }
    return ids.get(rootId)!;
  }

  private preorder(blocks: RestorableBlock[]): RestorableBlock[] {
    const ids = new Set(blocks.map((b) => b.id));
    const byParent = new Map<string | null, RestorableBlock[]>();
    for (const block of blocks) {
      const parent = block.parentId && ids.has(block.parentId) ? block.parentId : null;
      byParent.set(parent, [...(byParent.get(parent) ?? []), block]);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);
    const result: RestorableBlock[] = [];
    const walk = (parent: string | null) => {
      for (const block of byParent.get(parent) ?? []) {
        result.push(block);
        walk(block.id);
      }
    };
    walk(null);
    return result;
  }
}
