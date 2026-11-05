import { Global, Module } from '@nestjs/common';
import { AiSettingsRepository } from './ai-settings.repository';
import { AppSettingsRepository } from './app-settings.repository';
import { BlockRepository } from './block.repository';
import { createConnection } from './create-connection';
import { DATABASE_CONNECTION } from './database';
import { DatabaseService } from './database.service';
import { FileRepository } from './file.repository';
import { TrashRepository } from './trash.repository';
import { TrashRecorder } from '../trash/trash-recorder';
import { LinkRepository } from './link.repository';
import { PageRepository } from './page.repository';

export const DEFAULT_DATABASE_URL = 'pglite:./data/pglite';

@Global()
@Module({
  providers: [
    { provide: DATABASE_CONNECTION, useFactory: () => createConnection(process.env.DATABASE_URL || DEFAULT_DATABASE_URL) },
    DatabaseService,
    PageRepository,
    BlockRepository,
    LinkRepository,
    AiSettingsRepository,
    AppSettingsRepository,
    FileRepository,
    TrashRepository,
    TrashRecorder,
  ],
  exports: [
    DatabaseService,
    PageRepository,
    BlockRepository,
    LinkRepository,
    AiSettingsRepository,
    AppSettingsRepository,
    FileRepository,
    TrashRepository,
    TrashRecorder,
  ],
})
export class StorageModule {}
