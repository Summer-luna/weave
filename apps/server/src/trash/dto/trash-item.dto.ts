export class TrashItemDto {
  id: string;
  kind: 'page' | 'block';
  label: string;
  pageTitle: string;
  blockCount: number;
  deletedAt: string;
}
