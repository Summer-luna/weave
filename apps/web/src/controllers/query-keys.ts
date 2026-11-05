import { pageService } from '../services/page-service';

export const queryKeys = {
  pagesRoot: ['pages'] as const,
  pages: (q = '', limit = 0) => ['pages', 'list', q, limit] as const,
  pageRoot: ['page'] as const,
  page: (title: string) => ['page', pageService.titleKey(title)] as const,
  referencesRoot: ['references'] as const,
  references: (title: string) => ['references', pageService.titleKey(title)] as const,
  blockReferences: (id: string) => ['references', 'block', id] as const,
  blockRefRoot: ['blockRef'] as const,
  blockRef: (id: string) => ['blockRef', id] as const,
  blockSearch: (q: string) => ['blockSearch', q] as const,
};
