import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileService } from '../src/files/file.service';
import { FileRepository } from '../src/storage/file.repository';
import { createHarness, Harness } from './harness';

let h: Harness;
let dir: string;
let service: FileService;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'weave-files-'));
  process.env.UPLOAD_DIR = dir;
  h = await createHarness();
  service = new FileService(new FileRepository(h.database));
});

afterEach(async () => {
  await h.close();
  delete process.env.UPLOAD_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe('FileService', () => {
  it('stores uploads, fixes UTF-8 names and streams them back', async () => {
    const latin1Name = Buffer.from('截图.png', 'utf8').toString('latin1');
    const stored = await service.store({ originalname: latin1Name, mimetype: 'image/png', size: 4, buffer: Buffer.from('test') });
    expect(stored).toMatchObject({ name: '截图.png', mime: 'image/png', size: 4, url: `/api/files/${stored.id}` });
    const { file, stream } = await service.open(stored.id);
    expect(file.name).toBe('截图.png');
    let body = '';
    for await (const chunk of stream) body += chunk;
    expect(body).toBe('test');
  });

  it('rejects missing or oversized files and unknown ids', async () => {
    await expect(service.store(undefined)).rejects.toThrow();
    await expect(service.store({ originalname: 'big', mimetype: 'x', size: 26 * 1024 * 1024, buffer: Buffer.alloc(1) })).rejects.toThrow();
    await expect(service.open('missing123')).rejects.toThrow();
  });
});
