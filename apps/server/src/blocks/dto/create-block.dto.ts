import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { BLOCK_ID_PATTERN } from '../../common/uid';

export class CreateBlockDto {
  @IsOptional()
  @Matches(BLOCK_ID_PATTERN)
  id?: string;

  @IsString()
  pageId: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  index?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;
}
