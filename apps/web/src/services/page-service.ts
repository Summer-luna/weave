import { pageRepository } from '../repositories/page-repository';
import type { Page, PageState, PageSummary, References } from '../types/models';
import { outlineService } from './outline-service';

export class PageService {
  titleKey(title: string): string {
    return title.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  async loadState(title: string): Promise<PageState> {
    const detail = await pageRepository.getByTitle(title);
    return {
      title: detail.title,
      pageId: detail.page?.id ?? null,
      starred: detail.page?.starred ?? false,
      outline: outlineService.build(detail.blocks),
    };
  }

  list(q?: string, limit?: number): Promise<PageSummary[]> {
    return pageRepository.list(q, limit);
  }

  starred(): Promise<PageSummary[]> {
    return pageRepository.list(undefined, 100, true);
  }

  references(title: string): Promise<References> {
    return pageRepository.references(title);
  }

  ensure(title: string): Promise<Page> {
    return pageRepository.ensure(title);
  }

  rename(id: string, title: string): Promise<Page> {
    return pageRepository.update(id, { title });
  }

  setStarred(id: string, starred: boolean): Promise<Page> {
    return pageRepository.update(id, { starred });
  }

  delete(id: string): Promise<void> {
    return pageRepository.delete(id);
  }
}

export const pageService = new PageService();
