import createClient from 'openapi-fetch';
import type { paths } from './api-schema';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const apiClient = createClient<paths>({ baseUrl: '' });

export async function unwrap<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) {
    const message = (error as { message?: string | string[] } | undefined)?.message;
    throw new ApiError(response.status, Array.isArray(message) ? message.join('；') : (message ?? `请求失败（${response.status}）`));
  }
  return data as T;
}
