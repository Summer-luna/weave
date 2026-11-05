import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { ChatTurnDto } from './chat-turn.dto';

export class ChatRequestDto {
  @IsIn(['claude', 'openai', 'compatible'])
  provider: 'claude' | 'openai' | 'compatible';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  messages: ChatTurnDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  pageTitle?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  today?: string;

  @IsOptional()
  @IsIn(['page', 'library'])
  scope?: 'page' | 'library';
}
