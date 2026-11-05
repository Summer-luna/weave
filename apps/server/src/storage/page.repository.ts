import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, ilike, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from './database.service';
import { NewPageRow, PageRow, PageSummaryRow } from './rows';
import { pages } from './schema';

@Injectable()
export class PageRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<PageRow | undefined> {
    const [row] = await this.database.db.select().from(pages).where(eq(pages.id, id)).limit(1);
    return row;
  }

  async findByKey(key: string): Promise<PageRow | undefined> {
    const [row] = await this.database.db.select().from(pages).where(eq(pages.titleKey, key)).limit(1);
    return row;
  }

  list(titlePattern: string | undefined, starredOnly: boolean, limit: number): Promise<PageSummaryRow[]> {
    return this.database.db
      .select({
        ...getTableColumns(pages),
        blockCount: sql<number>`(select count(*)::int from blocks b where b.page_id = "pages"."id")`,
        refCount: sql<number>`(select count(*)::int from page_links l where l.page_id = "pages"."id")`,
      })
      .from(pages)
      .where(and(titlePattern ? ilike(pages.title, titlePattern) : undefined, starredOnly ? eq(pages.starred, true) : undefined))
      .orderBy(starredOnly ? asc(pages.titleKey) : desc(pages.updatedAt))
      .limit(limit);
  }

  async insertIfAbsent(row: NewPageRow): Promise<void> {
    await this.database.db.insert(pages).values(row).onConflictDoNothing({ target: pages.titleKey });
  }

  async updateTitle(id: string, title: string, key: string): Promise<void> {
    await this.database.db.update(pages).set({ title, titleKey: key, updatedAt: new Date() }).where(eq(pages.id, id));
  }

  async setStarred(id: string, starred: boolean): Promise<void> {
    await this.database.db.update(pages).set({ starred }).where(eq(pages.id, id));
  }

  async touch(id: string): Promise<void> {
    await this.database.db.update(pages).set({ updatedAt: new Date() }).where(eq(pages.id, id));
  }

  async deleteOrphans(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.database.db
      .delete(pages)
      .where(
        and(
          inArray(pages.id, ids),
          eq(pages.starred, false),
          sql`not exists (select 1 from blocks b where b.page_id = "pages"."id")`,
          sql`not exists (select 1 from page_links l where l.page_id = "pages"."id")`,
        ),
      );
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.database.db.delete(pages).where(eq(pages.id, id)).returning({ id: pages.id });
    return deleted.length > 0;
  }
}
