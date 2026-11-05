import { fileRepository, StoredFile } from '../repositories/file-repository';

const MAX_BYTES = 25 * 1024 * 1024;

export class AttachmentService {
  async uploadAll(files: File[]): Promise<string> {
    const tooLarge = files.find((file) => file.size > MAX_BYTES);
    if (tooLarge) throw new Error(`「${tooLarge.name}」超过 25MB`);
    const stored: StoredFile[] = [];
    for (const file of files) stored.push(await fileRepository.upload(this.named(file)));
    return stored.map((file) => this.markup(file)).join(' ');
  }

  markup(file: StoredFile): string {
    const label = file.name.replace(/[[\]]/g, '');
    return file.mime.startsWith('image/') ? `![${label}](${file.url})` : `[${label}](${file.url})`;
  }

  private named(file: File): File {
    if (file.name && file.name !== 'image.png') return file;
    // Pasted screenshots arrive as "image.png"; a timestamp keeps them distinguishable.
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const extension = file.type.split('/')[1] || 'bin';
    return new File([file], `粘贴-${stamp}.${extension}`, { type: file.type });
  }
}

export const attachmentService = new AttachmentService();
