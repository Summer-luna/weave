import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RestoreResultDto } from './dto/restore-result.dto';
import { TrashItemDto } from './dto/trash-item.dto';
import { TrashService } from './trash.service';

@ApiTags('trash')
@Controller('trash')
export class TrashController {
  constructor(private readonly trash: TrashService) {}

  @Get()
  listTrash(): Promise<TrashItemDto[]> {
    return this.trash.list();
  }

  @Post(':id/restore')
  @HttpCode(200)
  restoreTrashItem(@Param('id') id: string): Promise<RestoreResultDto> {
    return this.trash.restore(id);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteTrashItem(@Param('id') id: string): Promise<void> {
    return this.trash.remove(id);
  }

  @Delete()
  @HttpCode(204)
  emptyTrash(): Promise<void> {
    return this.trash.clear();
  }
}
