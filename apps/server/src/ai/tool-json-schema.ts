import { z } from 'zod';
import type { ToolSpec } from './ai-types';

export function toolJsonSchema(spec: ToolSpec): Record<string, unknown> & { type: 'object' } {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(spec.schema) as Record<string, unknown>;
  return { ...schema, type: 'object' };
}
