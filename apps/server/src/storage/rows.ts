import { aiSettings, blocks, files, pages, trash } from './schema';

export type TrashRow = typeof trash.$inferSelect;

export type FileRow = typeof files.$inferSelect;

export type AiSettingRow = typeof aiSettings.$inferSelect;

export type PageRow = typeof pages.$inferSelect;
export type NewPageRow = typeof pages.$inferInsert;
export type PageSummaryRow = PageRow & { blockCount: number; refCount: number };

export type BlockRow = typeof blocks.$inferSelect;
export type NewBlockRow = typeof blocks.$inferInsert;
export type BlockWithRefsRow = BlockRow & { refCount: number };
export type BlockWithPageRow = BlockRow & { pageTitle: string };
export type BreadcrumbRow = { id: string; content: string };
