import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  open?: boolean;
}
