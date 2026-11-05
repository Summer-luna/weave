import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { uid } from '../common/uid';
import { FileRepository } from '../storage/file.repository';
import { FileRow } from '../storage/rows';
import { StoredFileDto } from './dto/stored-file.dto';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface IncomingUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FileService {
  constructor(private readonly files: FileRepository) {}

  async store(upload: IncomingUpload | undefined): Promise<StoredFileDto> {
    if (!upload) throw new BadRequestException('没有收到文件');
    if (upload.size > MAX_FILE_BYTES) throw new BadRequestException('文件不能超过 25MB');
    // Multer decodes multipart filenames as latin1; browsers send UTF-8, so Chinese names need re-decoding.
    const decoded = Buffer.from(upload.originalname, 'latin1').toString('utf8');
    const name = decoded.replace(/[\\/\r\n]/g, '_').slice(0, 200) || 'file';
    const row = { id: uid(), name, mime: upload.mimetype || 'application/octet-stream', size: upload.size };
    await this.files.save(row, upload.buffer);
    return { ...row, url: `/api/files/${row.id}` };
  }

  async open(id: string): Promise<{ file: FileRow; stream: NodeJS.ReadableStream }> {
    const file = await this.files.find(id);
    if (!file) throw new NotFoundException('文件不存在');
    return { file, stream: this.files.open(id) };
  }
}
