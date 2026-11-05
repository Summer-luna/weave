import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MoveBlockDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsInt()
  @Min(0)
  index: number;
}
