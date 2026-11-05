import type { components } from './api-schema';
import { apiClient, unwrap } from './api-client';

export type TrashItem = components['schemas']['TrashItemDto'];
export type RestoreResult = components['schemas']['RestoreResultDto'];

export class TrashRepository {
  list(): Promise<TrashItem[]> {
    return unwrap(apiClient.GET('/api/trash'));
  }

  restore(id: string): Promise<RestoreResult> {
    return unwrap(apiClient.POST('/api/trash/{id}/restore', { params: { path: { id } } }));
  }

  async remove(id: string): Promise<void> {
    await unwrap(apiClient.DELETE('/api/trash/{id}', { params: { path: { id } } }));
  }

  async clear(): Promise<void> {
    await unwrap(apiClient.DELETE('/api/trash'));
  }
}

export const trashRepository = new TrashRepository();
