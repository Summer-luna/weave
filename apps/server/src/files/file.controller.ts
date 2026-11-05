import { Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { StoredFileDto } from './dto/stored-file.dto';
import { FileService, IncomingUpload, MAX_FILE_BYTES } from './file.service';

const INLINE_TYPES = /^(image|video|audio)\/|^application\/pdf$|^text\/plain$/;

@ApiTags('files')
@Controller('files')
export class FileController {
  constructor(private readonly files: FileService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  uploadFile(@UploadedFile() file: IncomingUpload | undefined): Promise<StoredFileDto> {
    return this.files.store(file);
  }

  @Get(':id')
  async getFile(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { file, stream } = await this.files.open(id);
    // SVG and HTML can run script under this origin, so only known-safe types are displayed inline.
    const inline = INLINE_TYPES.test(file.mime) && file.mime !== 'image/svg+xml';
    const disposition = inline ? 'inline' : 'attachment';
    res.setHeader('Content-Type', inline ? file.mime : 'application/octet-stream');
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    stream.pipe(res);
  }
}
