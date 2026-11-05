import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAiSettingDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  /** Omit to keep the saved key, send an empty string to remove it. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
}
