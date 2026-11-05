import type { z } from 'zod';

export type AiProviderId = 'claude' | 'openai' | 'compatible';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type AgentEvent =
  | { type: 'run'; runId: string; provider: AiProviderId; model: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; ok: boolean; output: string; mutated: boolean }
  | { type: 'confirm'; id: string; name: string; input: unknown }
  | { type: 'notice'; message: string }
  | { type: 'error'; message: string }
  | { type: 'done'; undoable: boolean };

export interface ToolSpec {
  name: string;
  description: string;
  schema: z.ZodType;
  destructive?: boolean;
  readOnly?: boolean;
}

/** read: search and read only; edit: also change notes; full: also delete (still confirmed per call). */
export const AGENT_PERMISSION_LEVELS = ['read', 'edit', 'full'] as const;
export type AgentPermissionLevel = (typeof AGENT_PERMISSION_LEVELS)[number];

export interface ToolOutcome {
  output: string;
  isError: boolean;
}

export type ToolExecutor = (callId: string, name: string, input: unknown) => Promise<ToolOutcome>;

export interface ProviderConfig {
  label: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AgentRunInput {
  system: string;
  turns: ChatTurn[];
  tools: ToolSpec[];
  execute: ToolExecutor;
  emit(event: AgentEvent): void;
  signal: AbortSignal;
  config: ProviderConfig;
}

export interface AgentProvider {
  readonly id: AiProviderId;
  /** Values used when the settings page leaves a field empty; they come from the environment (.env). */
  defaults(): ProviderConfig;
  isConfigured(config: ProviderConfig): boolean;
  run(input: AgentRunInput): Promise<void>;
  testConnection(config: ProviderConfig): Promise<string>;
}

export const MAX_AGENT_STEPS = 24;
