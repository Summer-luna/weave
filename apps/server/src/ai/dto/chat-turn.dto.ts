import { IsIn, IsString, MaxLength } from 'class-validator';

export class ChatTurnDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(100_000)
  content: string;
}
