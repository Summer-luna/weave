import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { BlocksModule } from './blocks/blocks.module';
import { FilesModule } from './files/files.module';
import { TrashModule } from './trash/trash.module';
import { PagesModule } from './pages/pages.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [StorageModule, PagesModule, BlocksModule, AiModule, FilesModule, TrashModule],
})
export class AppModule {}
