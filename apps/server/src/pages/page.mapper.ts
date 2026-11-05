import { PageRow, PageSummaryRow } from '../storage/rows';
import { PageDto } from './dto/page.dto';
import { PageSummaryDto } from './dto/page-summary.dto';

export function toPageDto(row: PageRow): PageDto {
  return { id: row.id, title: row.title, starred: row.starred, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export function toPageSummaryDto(row: PageSummaryRow): PageSummaryDto {
  return { ...toPageDto(row), blockCount: row.blockCount, refCount: row.refCount };
}
