import { ReferenceGroupDto } from './reference-group.dto';

export class ReferencesDto {
  linked: ReferenceGroupDto[];
  unlinked: ReferenceGroupDto[];
}
