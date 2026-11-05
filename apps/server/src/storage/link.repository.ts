import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseService } from './database.service';
import { blockRefs, pageLinks } from './schema';

@Injectable()
export class LinkRepository {
  constructor(private readonly database: DatabaseService) {}

  async linkedPageIds(blockIds: string[]): Promise<string[]> {
    if (blockIds.length === 0) return [];
    const rows = await this.database.db
      .selectDistinct({ pageId: pageLinks.pageId })
      .from(pageLinks)
      .where(inArray(pageLinks.blockId, blockIds));
    return rows.map((row) => row.pageId);
  }

  async replacePageLinks(blockId: string, pageIds: string[]): Promise<void> {
    await this.database.db.delete(pageLinks).where(eq(pageLinks.blockId, blockId));
    if (pageIds.length === 0) return;
    await this.database.db
      .insert(pageLinks)
      .values(pageIds.map((pageId) => ({ blockId, pageId })))
      .onConflictDoNothing();
  }

  async replaceBlockRefs(blockId: string, refIds: string[]): Promise<void> {
    await this.database.db.delete(blockRefs).where(eq(blockRefs.blockId, blockId));
    if (refIds.length === 0) return;
    await this.database.db
      .insert(blockRefs)
      .values(refIds.map((refId) => ({ blockId, refId })))
      .onConflictDoNothing();
  }
}
