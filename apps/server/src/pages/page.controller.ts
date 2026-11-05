import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreatePageDto } from './dto/create-page.dto';
import { ListPagesQueryDto } from './dto/list-pages-query.dto';
import { PageDto } from './dto/page.dto';
import { PageDetailDto } from './dto/page-detail.dto';
import { PageSummaryDto } from './dto/page-summary.dto';
import { ReferencesDto } from './dto/references.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PageService } from './page.service';

@ApiTags('pages')
@Controller('pages')
export class PageController {
  constructor(private readonly pages: PageService) {}

  @Get()
  listPages(@Query() query: ListPagesQueryDto): Promise<PageSummaryDto[]> {
    return this.pages.list(query.q, query.starred ?? false, query.limit ?? 200);
  }

  @Get('by-title/:title')
  getPageByTitle(@Param('title') title: string): Promise<PageDetailDto> {
    return this.pages.detail(title);
  }

  @Get('by-title/:title/references')
  getPageReferences(@Param('title') title: string): Promise<ReferencesDto> {
    return this.pages.references(title);
  }

  @Post()
  ensurePage(@Body() body: CreatePageDto): Promise<PageDto> {
    return this.pages.ensure(body.title);
  }

  @Patch(':id')
  updatePage(@Param('id') id: string, @Body() body: UpdatePageDto): Promise<PageDto> {
    return this.pages.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  deletePage(@Param('id') id: string): Promise<void> {
    return this.pages.remove(id);
  }
}
