import { ReferenceItemDto } from './reference-item.dto';

export class ReferenceGroupDto {
  pageId: string;
  pageTitle: string;
  items: ReferenceItemDto[];
}
