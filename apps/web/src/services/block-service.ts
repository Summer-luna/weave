import { blockRepository } from '../repositories/block-repository';
import type { Block, BlockRef, CreateBlockInput, MoveBlockInput, ReferenceGroup } from '../types/models';

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export class BlockService {
  newId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(bytes, (b) => ID_ALPHABET[b & 63]).join('');
  }

  async getOne(id: string): Promise<BlockRef | null> {
    const [block] = await blockRepository.getMany([id]);
    return block ?? null;
  }

  search(q: string, limit?: number): Promise<BlockRef[]> {
    return blockRepository.search(q, limit);
  }

  references(id: string): Promise<ReferenceGroup[]> {
    return blockRepository.references(id);
  }

  create(input: CreateBlockInput): Promise<Block> {
    return blockRepository.create(input);
  }

  updateContent(id: string, content: string): Promise<Block> {
    return blockRepository.update(id, { content });
  }

  setOpen(id: string, open: boolean): Promise<Block> {
    return blockRepository.update(id, { open });
  }

  move(id: string, input: MoveBlockInput): Promise<Block> {
    return blockRepository.move(id, input);
  }

  linkMention(id: string, title: string): Promise<Block> {
    return blockRepository.linkMention(id, title);
  }

  delete(id: string, trash = true): Promise<void> {
    return blockRepository.delete(id, trash);
  }
}

export const blockService = new BlockService();
