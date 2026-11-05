export interface TrashedBlock {
  id: string;
  parentId: string | null;
  position: number;
  content: string;
  open: boolean;
}

export interface TrashPayload {
  pageId: string;
  pageTitle: string;
  starred?: boolean;
  /** For block entries: where the root block sat. Pages restore every block as it was. */
  root?: { parentId: string | null; position: number };
  blocks: TrashedBlock[];
}
