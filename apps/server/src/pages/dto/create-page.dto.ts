import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;
}
