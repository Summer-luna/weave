import type { components } from '../repositories/api-schema';

type Schemas = components['schemas'];

export type Page = Schemas['PageDto'];
export type PageSummary = Schemas['PageSummaryDto'];
export type PageDetail = Schemas['PageDetailDto'];
export type Block = Schemas['BlockDto'];
export type BlockRef = Schemas['BlockRefDto'];
export type References = Schemas['ReferencesDto'];
export type ReferenceGroup = Schemas['ReferenceGroupDto'];
export type ReferenceItem = Schemas['ReferenceItemDto'];
export type CreateBlockInput = Schemas['CreateBlockDto'];
export type UpdateBlockInput = Schemas['UpdateBlockDto'];
export type MoveBlockInput = Schemas['MoveBlockDto'];

export interface OutlineNode {
  id: string;
  parentId: string | null;
  content: string;
  open: boolean;
  refCount: number;
  childIds: string[];
}

export interface Outline {
  rootIds: string[];
  nodes: Record<string, OutlineNode>;
}

export interface Placement {
  parentId: string | null;
  index: number;
}

export type OutlineOp =
  | { type: 'create'; id: string; content: string; open: boolean; at: Placement }
  | { type: 'move'; id: string; to: Placement }
  | { type: 'remove'; id: string }
  | { type: 'update'; id: string; content?: string; open?: boolean };

export interface PageState {
  title: string;
  pageId: string | null;
  starred: boolean;
  outline: Outline;
}

export type SidebarItem = { kind: 'page'; title: string } | { kind: 'block'; id: string };

export interface LayoutState {
  leftOpen: boolean;
  rightOpen: boolean;
  aiOpen: boolean;
  sidebar: SidebarItem[];
}

export type Caret = number | 'start' | 'end';

export interface FocusTarget {
  id: string;
  caret: Caret;
  seq: number;
}

export type AiProvider = Schemas['AiProviderDto'];
export type AiProviderId = AiProvider['id'];

export type AiEvent =
  | { type: 'run'; runId: string; provider: AiProviderId; model: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; ok: boolean; output: string; mutated: boolean }
  | { type: 'confirm'; id: string; name: string; input: unknown }
  | { type: 'notice'; message: string }
  | { type: 'error'; message: string }
  | { type: 'done'; undoable: boolean };

export type AiScope = 'page' | 'library';

export interface AiChatRequest {
  provider: AiProviderId;
  scope?: AiScope;
  messages: { role: 'user' | 'assistant'; content: string }[];
  pageTitle?: string;
  today?: string;
}

export type AiStepStatus = 'running' | 'ok' | 'error' | 'confirm';

export interface AiToolStep {
  id: string;
  name: string;
  input: unknown;
  status: AiStepStatus;
  output?: string;
}

export type AiAssistantPart = { kind: 'text'; text: string } | { kind: 'step'; id: string };

export type AiChatItem =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'assistant';
      text: string;
      steps: AiToolStep[];
      parts: AiAssistantPart[];
      notices: string[];
      status: 'streaming' | 'done' | 'error';
      error?: string;
      model?: string;
      runId?: string;
      undo?: 'available' | 'running' | 'done';
    };

export interface AiChatState {
  items: AiChatItem[];
  running: boolean;
  runId: string | null;
  provider: AiProviderId;
  scope: AiScope;
}

export type AiSetting = Schemas['AiSettingDto'];
export type UpdateAiSettingInput = Schemas['UpdateAiSettingDto'];
export type AgentPermissionLevel = Schemas['AgentPermissionDto']['level'];
