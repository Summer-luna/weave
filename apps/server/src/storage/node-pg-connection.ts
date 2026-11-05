import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';
import { Database, DatabaseConnection, MIGRATIONS_DIR } from './database';
import * as schema from './schema';

export class NodePgConnection implements DatabaseConnection {
  readonly db: Database;
  private readonly pool: Pool;

  constructor(private readonly url: string) {
    this.pool = new Pool({ connectionString: url });
    this.db = drizzle(this.pool, { schema }) as unknown as Database;
  }

  async migrate(): Promise<void> {
    await this.ensureDatabaseExists();
    await migrate(this.db as never, { migrationsFolder: MIGRATIONS_DIR });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async ensureDatabaseExists(): Promise<void> {
    try {
      await this.pool.query('select 1');
    } catch (error) {
      if ((error as { code?: string }).code !== '3D000') throw error;
      const target = new URL(this.url);
      const name = decodeURIComponent(target.pathname.slice(1));
      target.pathname = '/postgres';
      const admin = new Client({ connectionString: target.toString() });
      await admin.connect();
      try {
        await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      } finally {
        await admin.end();
      }
    }
  }
}
