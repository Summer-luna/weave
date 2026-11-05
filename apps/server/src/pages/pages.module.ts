import { Module } from '@nestjs/common';
import { LinksModule } from '../links/links.module';
import { PageController } from './page.controller';
import { PageService } from './page.service';

@Module({
  imports: [LinksModule],
  controllers: [PageController],
  providers: [PageService],
  exports: [PageService],
})
export class PagesModule {}
