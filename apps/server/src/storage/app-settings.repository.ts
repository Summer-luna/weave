import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from './database.service';
import { appSettings } from './schema';

@Injectable()
export class AppSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  async get(key: string): Promise<string | undefined> {
    const [row] = await this.database.db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return row?.value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.database.db
      .insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  }
}
