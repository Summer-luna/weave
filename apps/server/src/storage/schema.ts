import { AnyPgColumn, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { TrashPayload } from '../trash/trash-payload';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const pages = pgTable('pages', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  titleKey: text('title_key').notNull().unique(),
  starred: boolean('starred').notNull().default(false),
  ...timestamps,
});

export const aiSettings = pgTable('ai_settings', {
  provider: text('provider').primaryKey(),
  label: text('label').notNull().default(''),
  baseUrl: text('base_url').notNull().default(''),
  apiKey: text('api_key').notNull().default(''),
  model: text('model').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trash = pgTable(
  'trash',
  {
    id: text('id').primaryKey(),
    kind: text('kind').$type<'page' | 'block'>().notNull(),
    label: text('label').notNull(),
    pageTitle: text('page_title').notNull(),
    payload: jsonb('payload').$type<TrashPayload>().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('trash_deleted_idx').on(t.deletedAt)],
);

export const blocks = pgTable(
  'blocks',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnyPgColumn => blocks.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    content: text('content').notNull().default(''),
    open: boolean('open').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('blocks_page_parent_idx').on(t.pageId, t.parentId, t.position), index('blocks_parent_idx').on(t.parentId)],
);

export const pageLinks = pgTable(
  'page_links',
  {
    blockId: text('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.blockId, t.pageId] }), index('page_links_page_idx').on(t.pageId)],
);

export const blockRefs = pgTable(
  'block_refs',
  {
    blockId: text('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    refId: text('ref_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.blockId, t.refId] }), index('block_refs_ref_idx').on(t.refId)],
);
