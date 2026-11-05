import { BlockRow, BlockWithPageRow } from '../storage/rows';
import { BlockDto } from './dto/block.dto';
import { BlockRefDto } from './dto/block-ref.dto';

export function toBlockDto(row: BlockRow & { refCount?: number }): BlockDto {
  return {
    id: row.id,
    pageId: row.pageId,
    parentId: row.parentId,
    position: row.position,
    content: row.content,
    open: row.open,
    refCount: row.refCount ?? 0,
  };
}

export function toBlockRefDto(row: BlockWithPageRow): BlockRefDto {
  return { id: row.id, pageId: row.pageId, pageTitle: row.pageTitle, content: row.content };
}
