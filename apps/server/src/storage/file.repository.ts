import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createReadStream, ReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseService } from './database.service';
import { FileRow } from './rows';
import { files } from './schema';

@Injectable()
export class FileRepository {
  private readonly root = resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'data', 'uploads'));

  constructor(private readonly database: DatabaseService) {}

  async save(row: Omit<FileRow, 'createdAt'>, content: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.path(row.id), content);
    try {
      await this.database.db.insert(files).values(row);
    } catch (error) {
      await rm(this.path(row.id), { force: true });
      throw error;
    }
  }

  async find(id: string): Promise<FileRow | undefined> {
    const [row] = await this.database.db.select().from(files).where(eq(files.id, id)).limit(1);
    return row;
  }

  open(id: string): ReadStream {
    return createReadStream(this.path(id));
  }

  private path(id: string): string {
    return join(this.root, id);
  }
}
