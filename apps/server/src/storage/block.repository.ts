import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, gte, ilike, inArray, isNull, ne, notExists, or, SQL, sql } from 'drizzle-orm';
import { DatabaseService } from './database.service';
import { BlockWithPageRow, BlockWithRefsRow, BreadcrumbRow, NewBlockRow } from './rows';
import { blockRefs, blocks, pageLinks, pages } from './schema';

const refCount = sql<number>`(select count(*)::int from block_refs r where r.ref_id = "blocks"."id")`;

@Injectable()
export class BlockRepository {
  constructor(private readonly database: DatabaseService) {}

  findByPage(pageId: string): Promise<BlockWithRefsRow[]> {
    return this.database.db
      .select({ ...getTableColumns(blocks), refCount })
      .from(blocks)
      .where(eq(blocks.pageId, pageId))
      .orderBy(asc(blocks.position));
  }

  async findById(id: string): Promise<BlockWithRefsRow | undefined> {
    const [row] = await this.database.db
      .select({ ...getTableColumns(blocks), refCount })
      .from(blocks)
      .where(eq(blocks.id, id))
      .limit(1);
    return row;
  }

  findWithPageByIds(ids: string[]): Promise<BlockWithPageRow[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.withPage().where(inArray(blocks.id, ids));
  }

  search(contentPattern: string, limit: number): Promise<BlockWithPageRow[]> {
    return this.withPage()
      .where(and(ilike(blocks.content, contentPattern), ne(blocks.content, '')))
      .orderBy(desc(blocks.updatedAt))
      .limit(limit);
  }

  findLinkingToPage(pageId: string): Promise<BlockWithPageRow[]> {
    return this.database.db
      .select({ ...getTableColumns(blocks), pageTitle: pages.title })
      .from(blocks)
      .innerJoin(pageLinks, eq(pageLinks.blockId, blocks.id))
      .innerJoin(pages, eq(pages.id, blocks.pageId))
      .where(eq(pageLinks.pageId, pageId))
      .orderBy(desc(pages.updatedAt), asc(blocks.pageId), asc(blocks.position));
  }

  findReferencingBlock(refId: string): Promise<BlockWithPageRow[]> {
    return this.database.db
      .select({ ...getTableColumns(blocks), pageTitle: pages.title })
      .from(blocks)
      .innerJoin(blockRefs, eq(blockRefs.blockId, blocks.id))
      .innerJoin(pages, eq(pages.id, blocks.pageId))
      .where(eq(blockRefs.refId, refId))
      .orderBy(desc(pages.updatedAt), asc(blocks.pageId), asc(blocks.position));
  }

  findMentioning(contentPattern: string, excludePageId: string | null, limit: number): Promise<BlockWithPageRow[]> {
    const conditions: SQL[] = [ilike(blocks.content, contentPattern)];
    if (excludePageId) {
      conditions.push(ne(blocks.pageId, excludePageId));
      conditions.push(
        notExists(
          this.database.db
            .select({ one: sql`1` })
            .from(pageLinks)
            .where(and(eq(pageLinks.blockId, blocks.id), eq(pageLinks.pageId, excludePageId))),
        ),
      );
    }
    return this.withPage()
      .where(and(...conditions))
      .orderBy(desc(pages.updatedAt), asc(blocks.pageId), asc(blocks.position))
      .limit(limit);
  }

  ancestors(id: string): Promise<BreadcrumbRow[]> {
    return this.database.rows<BreadcrumbRow>(sql`
      WITH RECURSIVE chain(id, parent_id, content, depth) AS (
        SELECT b.id, b.parent_id, b.content, 0
        FROM blocks b
        WHERE b.id = (SELECT parent_id FROM blocks WHERE id = ${id})
        UNION ALL
        SELECT b.id, b.parent_id, b.content, c.depth + 1
        FROM blocks b
        JOIN chain c ON b.id = c.parent_id
      )
      SELECT id, content FROM chain ORDER BY depth DESC
    `);
  }

  async ancestorsForMany(ids: string[]): Promise<Map<string, BreadcrumbRow[]>> {
    const result = new Map<string, BreadcrumbRow[]>(ids.map((id) => [id, []]));
    if (ids.length === 0) return result;
    const rows = await this.database.rows<BreadcrumbRow & { origin: string }>(sql`
      WITH RECURSIVE chain(origin, id, parent_id, content, depth) AS (
        SELECT b.id, p.id, p.parent_id, p.content, 0
        FROM blocks b
        JOIN blocks p ON p.id = b.parent_id
        WHERE b.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
        UNION ALL
        SELECT c.origin, b.id, b.parent_id, b.content, c.depth + 1
        FROM blocks b
        JOIN chain c ON b.id = c.parent_id
      )
      SELECT origin, id, content FROM chain ORDER BY origin, depth DESC
    `);
    for (const row of rows) result.get(row.origin)?.push({ id: row.id, content: row.content });
    return result;
  }

  searchAny(contentPatterns: string[], limit: number): Promise<(BlockWithPageRow & { hits: number })[]> {
    const hits = sql.join(
      contentPatterns.map((pattern) => sql`(${blocks.content} ilike ${pattern})::int`),
      sql` + `,
    );
    return this.database.db
      .select({ ...getTableColumns(blocks), pageTitle: pages.title, hits: sql<number>`(${hits})` })
      .from(blocks)
      .innerJoin(pages, eq(pages.id, blocks.pageId))
      .where(or(...contentPatterns.map((pattern) => ilike(blocks.content, pattern))))
      .orderBy(desc(sql`(${hits})`), desc(blocks.updatedAt))
      .limit(limit);
  }

  async isAncestor(ancestorId: string, blockId: string): Promise<boolean> {
    const rows = await this.database.rows<{ found: number }>(sql`
      WITH RECURSIVE chain(id, parent_id) AS (
        SELECT id, parent_id FROM blocks WHERE id = ${blockId}
        UNION ALL
        SELECT b.id, b.parent_id FROM blocks b JOIN chain c ON b.id = c.parent_id
      )
      SELECT 1 AS found FROM chain WHERE id = ${ancestorId} LIMIT 1
    `);
    return rows.length > 0;
  }

  async siblingCount(pageId: string, parentId: string | null, excludeId?: string): Promise<number> {
    const [row] = await this.database.db
      .select({ n: sql<number>`count(*)::int` })
      .from(blocks)
      .where(this.siblingsOf(pageId, parentId, excludeId));
    return row?.n ?? 0;
  }

  async shiftPositions(pageId: string, parentId: string | null, fromIndex: number, delta: number, excludeId?: string): Promise<void> {
    await this.database.db
      .update(blocks)
      .set({ position: sql`${blocks.position} + ${delta}` })
      .where(and(this.siblingsOf(pageId, parentId, excludeId), gte(blocks.position, fromIndex)));
  }

  async subtreeIds(id: string): Promise<string[]> {
    const rows = await this.database.rows<{ id: string }>(sql`
      WITH RECURSIVE tree(id) AS (
        SELECT id FROM blocks WHERE id = ${id}
        UNION ALL
        SELECT b.id FROM blocks b JOIN tree t ON b.parent_id = t.id
      )
      SELECT id FROM tree
    `);
    return rows.map((row) => row.id);
  }

  async insert(row: NewBlockRow): Promise<void> {
    await this.database.db.insert(blocks).values(row);
  }

  async updateContent(id: string, content: string): Promise<void> {
    await this.database.db.update(blocks).set({ content, updatedAt: new Date() }).where(eq(blocks.id, id));
  }

  async updateOpen(id: string, open: boolean): Promise<void> {
    await this.database.db.update(blocks).set({ open }).where(eq(blocks.id, id));
  }

  async place(id: string, parentId: string | null, position: number): Promise<void> {
    await this.database.db.update(blocks).set({ parentId, position, updatedAt: new Date() }).where(eq(blocks.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.database.db.delete(blocks).where(eq(blocks.id, id));
  }

  private withPage() {
    return this.database.db
      .select({ ...getTableColumns(blocks), pageTitle: pages.title })
      .from(blocks)
      .innerJoin(pages, eq(pages.id, blocks.pageId))
      .$dynamic();
  }

  private siblingsOf(pageId: string, parentId: string | null, excludeId?: string): SQL | undefined {
    return and(
      eq(blocks.pageId, pageId),
      parentId === null ? isNull(blocks.parentId) : eq(blocks.parentId, parentId),
      excludeId ? ne(blocks.id, excludeId) : undefined,
    );
  }
}
