import { ApiError } from './api-client';

export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
}

export class FileRepository {
  async upload(file: File): Promise<StoredFile> {
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await fetch('/api/files', { method: 'POST', body: form });
    const body = (await response.json().catch(() => null)) as (StoredFile & { message?: string | string[] }) | null;
    if (!response.ok || !body) {
      const message = Array.isArray(body?.message) ? body.message.join('；') : body?.message;
      throw new ApiError(response.status, message ?? `上传失败（${response.status}）`);
    }
    return body;
  }
}

export const fileRepository = new FileRepository();
