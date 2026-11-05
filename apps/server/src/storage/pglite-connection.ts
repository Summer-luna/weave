import { Extension, PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { mkdirSync } from 'node:fs';
import { Database, DatabaseConnection, MIGRATIONS_DIR } from './database';
import * as schema from './schema';

// The extension's types are only reachable through package "exports", which this project's node10 resolution ignores.
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm') as { pg_trgm: Extension };

export class PgliteConnection implements DatabaseConnection {
  readonly db: Database;
  private readonly client: PGlite;

  constructor(dataDir?: string) {
    if (dataDir) mkdirSync(dataDir, { recursive: true });
    this.client = new PGlite({ dataDir, extensions: { pg_trgm } });
    this.db = drizzle(this.client, { schema }) as unknown as Database;
  }

  async migrate(): Promise<void> {
    await migrate(this.db as never, { migrationsFolder: MIGRATIONS_DIR });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
