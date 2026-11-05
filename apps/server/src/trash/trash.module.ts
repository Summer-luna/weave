import { Module } from '@nestjs/common';
import { BlocksModule } from '../blocks/blocks.module';
import { PagesModule } from '../pages/pages.module';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

@Module({
  imports: [PagesModule, BlocksModule],
  controllers: [TrashController],
  providers: [TrashService],
  exports: [TrashService],
})
export class TrashModule {}
