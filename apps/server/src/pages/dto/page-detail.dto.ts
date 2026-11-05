import { BlockDto } from '../../blocks/dto/block.dto';
import { PageDto } from './page.dto';

export class PageDetailDto {
  title: string;
  page: PageDto | null;
  blocks: BlockDto[];
}
