export class BlockDto {
  id: string;
  pageId: string;
  parentId: string | null;
  position: number;
  content: string;
  open: boolean;
  refCount: number;
}
