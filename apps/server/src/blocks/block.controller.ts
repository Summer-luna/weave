import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReferenceGroupDto } from '../pages/dto/reference-group.dto';
import { BlockService } from './block.service';
import { BlockDto } from './dto/block.dto';
import { BlockIdsQueryDto } from './dto/block-ids-query.dto';
import { BlockRefDto } from './dto/block-ref.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { LinkMentionDto } from './dto/link-mention.dto';
import { MoveBlockDto } from './dto/move-block.dto';
import { SearchBlocksQueryDto } from './dto/search-blocks-query.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

@ApiTags('blocks')
@Controller('blocks')
export class BlockController {
  constructor(private readonly blocks: BlockService) {}

  @Get()
  getBlocks(@Query() query: BlockIdsQueryDto): Promise<BlockRefDto[]> {
    return this.blocks.getMany(query.ids.split(','));
  }

  @Get('search')
  searchBlocks(@Query() query: SearchBlocksQueryDto): Promise<BlockRefDto[]> {
    return this.blocks.search(query.q, query.limit ?? 20);
  }

  @Get(':id')
  getBlock(@Param('id') id: string): Promise<BlockDto> {
    return this.blocks.get(id);
  }

  @Get(':id/references')
  getBlockReferences(@Param('id') id: string): Promise<ReferenceGroupDto[]> {
    return this.blocks.references(id);
  }

  @Post()
  createBlock(@Body() body: CreateBlockDto): Promise<BlockDto> {
    return this.blocks.create(body);
  }

  @Patch(':id')
  updateBlock(@Param('id') id: string, @Body() body: UpdateBlockDto): Promise<BlockDto> {
    return this.blocks.update(id, body);
  }

  @Post(':id/move')
  @HttpCode(200)
  moveBlock(@Param('id') id: string, @Body() body: MoveBlockDto): Promise<BlockDto> {
    return this.blocks.move(id, body);
  }

  @Post(':id/link-mention')
  @HttpCode(200)
  linkMention(@Param('id') id: string, @Body() body: LinkMentionDto): Promise<BlockDto> {
    return this.blocks.linkMention(id, body.title);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiQuery({ name: 'trash', required: false, description: 'Set to "false" to skip the trash (merges, undo).' })
  deleteBlock(@Param('id') id: string, @Query('trash') trash?: string): Promise<void> {
    return this.blocks.remove(id, { trash: trash !== 'false' });
  }
}
