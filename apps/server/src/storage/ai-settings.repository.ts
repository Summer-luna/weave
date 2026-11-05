import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from './database.service';
import { AiSettingRow } from './rows';
import { aiSettings } from './schema';

@Injectable()
export class AiSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  async find(provider: string): Promise<AiSettingRow | undefined> {
    const [row] = await this.database.db.select().from(aiSettings).where(eq(aiSettings.provider, provider)).limit(1);
    return row;
  }

  async upsert(row: Omit<AiSettingRow, 'updatedAt'>): Promise<void> {
    const { provider, ...values } = row;
    await this.database.db
      .insert(aiSettings)
      .values({ ...row, updatedAt: new Date() })
      .onConflictDoUpdate({ target: aiSettings.provider, set: { ...values, updatedAt: new Date() } });
  }
}
