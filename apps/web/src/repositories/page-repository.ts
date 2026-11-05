import type { Page, PageDetail, PageSummary, References } from '../types/models';
import { apiClient, unwrap } from './api-client';

export class PageRepository {
  list(q?: string, limit?: number, starred?: boolean): Promise<PageSummary[]> {
    return unwrap(apiClient.GET('/api/pages', { params: { query: { q, limit, starred } } }));
  }

  getByTitle(title: string): Promise<PageDetail> {
    return unwrap(apiClient.GET('/api/pages/by-title/{title}', { params: { path: { title } } }));
  }

  references(title: string): Promise<References> {
    return unwrap(apiClient.GET('/api/pages/by-title/{title}/references', { params: { path: { title } } }));
  }

  ensure(title: string): Promise<Page> {
    return unwrap(apiClient.POST('/api/pages', { body: { title } }));
  }

  update(id: string, changes: { title?: string; starred?: boolean }): Promise<Page> {
    return unwrap(apiClient.PATCH('/api/pages/{id}', { params: { path: { id } }, body: changes }));
  }

  async delete(id: string): Promise<void> {
    await unwrap(apiClient.DELETE('/api/pages/{id}', { params: { path: { id } } }));
  }
}

export const pageRepository = new PageRepository();
