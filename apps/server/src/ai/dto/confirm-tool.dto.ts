import { IsBoolean } from 'class-validator';

export class ConfirmToolDto {
  @IsBoolean()
  approved: boolean;
}
