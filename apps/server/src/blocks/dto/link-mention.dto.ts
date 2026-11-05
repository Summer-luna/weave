import { IsString, MaxLength, MinLength } from 'class-validator';

export class LinkMentionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;
}
