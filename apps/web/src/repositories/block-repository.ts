import type { Block, BlockRef, CreateBlockInput, MoveBlockInput, ReferenceGroup, UpdateBlockInput } from '../types/models';
import { apiClient, unwrap } from './api-client';

export class BlockRepository {
  getMany(ids: string[]): Promise<BlockRef[]> {
    return unwrap(apiClient.GET('/api/blocks', { params: { query: { ids: ids.join(',') } } }));
  }

  search(q: string, limit = 20): Promise<BlockRef[]> {
    return unwrap(apiClient.GET('/api/blocks/search', { params: { query: { q, limit } } }));
  }

  references(id: string): Promise<ReferenceGroup[]> {
    return unwrap(apiClient.GET('/api/blocks/{id}/references', { params: { path: { id } } }));
  }

  create(input: CreateBlockInput): Promise<Block> {
    return unwrap(apiClient.POST('/api/blocks', { body: input }));
  }

  update(id: string, input: UpdateBlockInput): Promise<Block> {
    return unwrap(apiClient.PATCH('/api/blocks/{id}', { params: { path: { id } }, body: input }));
  }

  move(id: string, input: MoveBlockInput): Promise<Block> {
    return unwrap(apiClient.POST('/api/blocks/{id}/move', { params: { path: { id } }, body: input }));
  }

  linkMention(id: string, title: string): Promise<Block> {
    return unwrap(apiClient.POST('/api/blocks/{id}/link-mention', { params: { path: { id } }, body: { title } }));
  }

  async delete(id: string, trash = true): Promise<void> {
    await unwrap(apiClient.DELETE('/api/blocks/{id}', { params: { path: { id }, query: { trash: trash ? undefined : 'false' } } }));
  }
}

export const blockRepository = new BlockRepository();
