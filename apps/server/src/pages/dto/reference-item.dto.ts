import { BlockDto } from '../../blocks/dto/block.dto';
import { BreadcrumbDto } from './breadcrumb.dto';

export class ReferenceItemDto {
  block: BlockDto;
  breadcrumbs: BreadcrumbDto[];
}
