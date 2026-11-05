import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Put, Res } from '@nestjs/common';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AgentPermissionService } from './agent-permission.service';
import { AgentService } from './agent.service';
import { AgentPermissionDto } from './dto/agent-permission.dto';
import { AiSettingsService } from './ai-settings.service';
import type { AiProviderId } from './ai-types';
import { AiSettingDto } from './dto/ai-setting.dto';
import { AI_PROVIDER_IDS } from './dto/provider-param';
import { TestResultDto } from './dto/test-result.dto';
import { UndoRunResultDto } from './dto/undo-run-result.dto';
import { UpdateAiSettingDto } from './dto/update-ai-setting.dto';
import { AiProviderDto } from './dto/ai-provider.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ConfirmToolDto } from './dto/confirm-tool.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    private readonly agent: AgentService,
    private readonly settings: AiSettingsService,
    private readonly permissions: AgentPermissionService,
  ) {}

  @Get('permission')
  async getAgentPermission(): Promise<AgentPermissionDto> {
    return { level: await this.permissions.get() };
  }

  @Put('permission')
  async updateAgentPermission(@Body() body: AgentPermissionDto): Promise<AgentPermissionDto> {
    return { level: await this.permissions.set(body.level) };
  }

  @Get('providers')
  listAiProviders(): Promise<AiProviderDto[]> {
    return this.agent.listProviders();
  }

  @Get('settings')
  listAiSettings(): Promise<AiSettingDto[]> {
    return this.settings.list();
  }

  @Put('settings/:provider')
  updateAiSetting(@Param('provider') provider: string, @Body() body: UpdateAiSettingDto): Promise<AiSettingDto> {
    return this.settings.update(this.providerId(provider), body);
  }

  @Post('settings/:provider/test')
  @HttpCode(200)
  async testAiSetting(@Param('provider') provider: string): Promise<TestResultDto> {
    return { message: await this.settings.test(this.providerId(provider)) };
  }

  private providerId(value: string): AiProviderId {
    if (!(AI_PROVIDER_IDS as readonly string[]).includes(value)) throw new BadRequestException('未知的 AI 提供方');
    return value as AiProviderId;
  }

  @Post('chat')
  @ApiProduces('text/event-stream')
  async chat(@Body() body: ChatRequestDto, @Res() res: Response): Promise<void> {
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    try {
      await this.agent.run(body, (event) => res.write(`data: ${JSON.stringify(event)}\n\n`), abort.signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }
    res.end();
  }

  @Post('runs/:runId/undo')
  @HttpCode(200)
  undoAiRun(@Param('runId') runId: string): Promise<UndoRunResultDto> {
    return this.agent.undoRun(runId);
  }

  @Post('runs/:runId/tools/:callId/confirm')
  @HttpCode(204)
  confirmTool(@Param('runId') runId: string, @Param('callId') callId: string, @Body() body: ConfirmToolDto): void {
    if (!this.agent.confirm(runId, callId, body.approved)) throw new NotFoundException('这个操作已经不在等待确认了');
  }
}
