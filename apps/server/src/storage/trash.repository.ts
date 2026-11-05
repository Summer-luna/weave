import { Injectable } from '@nestjs/common';
import { desc, eq, notInArray } from 'drizzle-orm';
import { DatabaseService } from './database.service';
import { TrashRow } from './rows';
import { trash } from './schema';

const KEEP_ENTRIES = 500;

@Injectable()
export class TrashRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(row: Omit<TrashRow, 'deletedAt'>): Promise<void> {
    await this.database.db.insert(trash).values(row);
    const keep = this.database.db.select({ id: trash.id }).from(trash).orderBy(desc(trash.deletedAt)).limit(KEEP_ENTRIES);
    await this.database.db.delete(trash).where(notInArray(trash.id, keep));
  }

  list(limit: number): Promise<TrashRow[]> {
    return this.database.db.select().from(trash).orderBy(desc(trash.deletedAt)).limit(limit);
  }

  async find(id: string): Promise<TrashRow | undefined> {
    const [row] = await this.database.db.select().from(trash).where(eq(trash.id, id)).limit(1);
    return row;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.database.db.delete(trash).where(eq(trash.id, id)).returning({ id: trash.id });
    return deleted.length > 0;
  }

  async clear(): Promise<void> {
    await this.database.db.delete(trash);
  }
}
