import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AGENT_PERMISSION_LEVELS } from '../ai-types';
import type { AgentPermissionLevel } from '../ai-types';

export class AgentPermissionDto {
  @ApiProperty({ enum: AGENT_PERMISSION_LEVELS })
  @IsIn(AGENT_PERMISSION_LEVELS)
  level: AgentPermissionLevel;
}
