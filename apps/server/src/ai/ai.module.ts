import { Module } from '@nestjs/common';
import { BlocksModule } from '../blocks/blocks.module';
import { PagesModule } from '../pages/pages.module';
import { TrashModule } from '../trash/trash.module';
import { AgentService } from './agent.service';
import { AiRunJournal } from './ai-run-journal';
import { AiSettingsService } from './ai-settings.service';
import { AiController } from './ai.controller';
import { ClaudeProvider } from './claude-provider';
import { CompatibleProvider } from './compatible-provider';
import { ConfirmationRegistry } from './confirmation-registry';
import { NoteToolkit } from './note-toolkit';
import { OpenAiProvider } from './openai-provider';

@Module({
  imports: [PagesModule, BlocksModule, TrashModule],
  controllers: [AiController],
  providers: [AgentService, AiRunJournal, AiSettingsService, ClaudeProvider, OpenAiProvider, CompatibleProvider, NoteToolkit, ConfirmationRegistry],
})
export class AiModule {}
