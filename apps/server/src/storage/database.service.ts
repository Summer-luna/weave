import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SQL } from 'drizzle-orm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Database, DATABASE_CONNECTION, DatabaseConnection } from './database';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly scope = new AsyncLocalStorage<Database>();

  constructor(@Inject(DATABASE_CONNECTION) private readonly connection: DatabaseConnection) {}

  get db(): Database {
    return this.scope.getStore() ?? this.connection.db;
  }

  async onModuleInit(): Promise<void> {
    await this.connection.migrate();
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection.close();
  }

  transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.scope.getStore()) return work();
    return this.connection.db.transaction((tx) => this.scope.run(tx as unknown as Database, work));
  }

  async rows<T>(query: SQL): Promise<T[]> {
    const result = (await this.db.execute(query)) as unknown as { rows: T[] };
    return result.rows;
  }
}
