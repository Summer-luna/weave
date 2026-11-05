import { PageDto } from './page.dto';

export class PageSummaryDto extends PageDto {
  blockCount: number;
  refCount: number;
}
