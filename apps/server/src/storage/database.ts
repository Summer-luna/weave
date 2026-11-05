import { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { resolve } from 'node:path';
import * as schema from './schema';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_DIR = resolve(__dirname, '..', '..', 'drizzle');

export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

export interface DatabaseConnection {
  readonly db: Database;
  migrate(): Promise<void>;
  close(): Promise<void>;
}
