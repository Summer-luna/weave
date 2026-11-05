import { Module } from '@nestjs/common';
import { LinksModule } from '../links/links.module';
import { PagesModule } from '../pages/pages.module';
import { BlockController } from './block.controller';
import { BlockService } from './block.service';
import { OutlineRestorer } from './outline-restorer';

@Module({
  imports: [LinksModule, PagesModule],
  controllers: [BlockController],
  providers: [BlockService, OutlineRestorer],
  exports: [BlockService, OutlineRestorer],
})
export class BlocksModule {}
