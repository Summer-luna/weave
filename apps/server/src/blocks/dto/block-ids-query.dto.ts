import { IsString } from 'class-validator';

export class BlockIdsQueryDto {
  @IsString()
  ids: string;
}
