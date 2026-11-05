import { z } from 'zod';
import type { ToolSpec } from './ai-types';

const title = z.string().min(1).max(300).describe('Exact page title, e.g. "Deep Work" or a daily note title like "2026-11-05".');
const blockId = z.string().min(6).max(24).describe('Block id as shown in brackets by read_page / search_blocks.');

export const NOTE_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'search_pages',
    description:
      'Find pages whose title contains the query (case-insensitive), most recently edited first. Use it to reuse existing page titles before creating links or tags, or with starred_only to list the sidebar favourites.',
    schema: z.object({
      query: z.string().describe('Substring of the title; empty string lists recently edited pages.'),
      starred_only: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    readOnly: true,
  },
  {
    name: 'search_notes',
    description:
      'Search the whole note library with several keywords at once (blocks matching any keyword, ranked by how many keywords they contain). Pass synonyms and both Chinese and English variants to improve recall. Returns block ids, page titles, ancestor context and contents.',
    schema: z.object({
      keywords: z.array(z.string().min(1).max(100)).min(1).max(12),
      limit: z.number().int().min(1).max(80).optional(),
    }),
    readOnly: true,
  },
  {
    name: 'search_blocks',
    description: 'Full-text search over block contents across all pages. Returns block ids, page titles and contents.',
    schema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    readOnly: true,
  },
  {
    name: 'read_page',
    description: 'Read a page as an indented outline (every block shown as "[id] content"), plus its linked references and unlinked mentions.',
    schema: z.object({ title }),
    readOnly: true,
  },
  {
    name: 'read_block',
    description: 'Read one block with its page title, ancestors and all descendants.',
    schema: z.object({ id: blockId }),
    readOnly: true,
  },
  {
    name: 'get_block_references',
    description: 'List the blocks that embed this block with ((blockId)), grouped by page.',
    schema: z.object({ id: blockId }),
    readOnly: true,
  },
  {
    name: 'list_daily_notes',
    description: 'List the daily notes of a month that have content (what the calendar view highlights), with their block counts.',
    schema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).describe('Month as YYYY-MM, e.g. "2026-11".') }),
    readOnly: true,
  },
  {
    name: 'list_templates',
    description: 'List template pages (titles starting with "模板/"), the ones the / menu offers.',
    schema: z.object({}),
    readOnly: true,
  },
  {
    name: 'create_page',
    description: 'Create a page (no-op if it already exists). Pages are also created automatically when a block links to them.',
    schema: z.object({ title }),
  },
  {
    name: 'insert_blocks',
    description:
      'Insert one or more blocks into a page (the page is created if missing). Each block may have nested children. Use parent_id to insert under an existing block and index for the position among its siblings (default: append at the end).',
    schema: z.object({
      page_title: title,
      parent_id: blockId.optional(),
      index: z.number().int().min(0).optional(),
      blocks: z
        .array(
          z.object({
            content: z.string().max(20000),
            children: z.array(z.object({ content: z.string().max(20000), children: z.array(z.object({ content: z.string().max(20000) })).optional() })).optional(),
          }),
        )
        .min(1)
        .max(100),
    }),
  },
  {
    name: 'apply_template',
    description:
      'Copy every block of a template page into a page, like choosing a template in the / menu. Appends at the end unless parent_id / index are given.',
    schema: z.object({
      template_title: title.describe('Template page title, e.g. "模板/周报".'),
      page_title: title,
      parent_id: blockId.optional(),
      index: z.number().int().min(0).optional(),
    }),
  },
  {
    name: 'update_block',
    description: 'Replace the full text of a block. Keep the user\'s wording; only add markup such as [[links]] or #tags unless asked to rewrite.',
    schema: z.object({ id: blockId, content: z.string().max(20000) }),
  },
  {
    name: 'set_todo',
    description: 'Turn a block into an open todo, mark it done, or make it a plain block again (the "[ ] " / "[x] " prefix).',
    schema: z.object({ id: blockId, state: z.enum(['todo', 'done', 'none']) }),
  },
  {
    name: 'set_block_collapsed',
    description: 'Collapse or expand a block that has children, like clicking its bullet arrow.',
    schema: z.object({ id: blockId, collapsed: z.boolean() }),
  },
  {
    name: 'move_block',
    description: 'Move a block (with its children) under another block of the same page, or to the top level when parent_id is null.',
    schema: z.object({ id: blockId, parent_id: blockId.nullable(), index: z.number().int().min(0) }),
  },
  {
    name: 'delete_block',
    description: 'Delete a block and all its children. It goes to the trash; the user is asked to confirm first.',
    schema: z.object({ id: blockId }),
    destructive: true,
  },
  {
    name: 'rename_page',
    description: 'Rename a page. Every [[link]] and #tag pointing at it is rewritten automatically.',
    schema: z.object({ title, new_title: z.string().min(1).max(300) }),
  },
  {
    name: 'delete_page',
    description: 'Delete a page and all of its blocks. It goes to the trash; the user is asked to confirm first.',
    schema: z.object({ title }),
    destructive: true,
  },
  {
    name: 'set_page_starred',
    description: 'Star or unstar a page; starred pages are pinned in the left sidebar.',
    schema: z.object({ title, starred: z.boolean() }),
  },
  {
    name: 'add_page_tags',
    description:
      'Add tags to a page. They are kept in a single "标签：" block at the top of the page and merged with existing ones. Prefer titles of existing pages.',
    schema: z.object({ title, tags: z.array(z.string().min(1).max(100)).min(1).max(20) }),
  },
  {
    name: 'link_unlinked_mentions',
    description: 'Turn plain-text mentions of a page title in other pages into [[links]]. Optionally limit to specific block ids.',
    schema: z.object({ title, block_ids: z.array(blockId).optional() }),
  },
  {
    name: 'list_trash',
    description: 'List what is in the trash (deleted pages and blocks), newest first, with the ids needed to restore them.',
    schema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
    readOnly: true,
  },
  {
    name: 'restore_from_trash',
    description: 'Restore a deleted page or block from the trash to where it was. A page whose title is taken again gets a "（恢复）" suffix.',
    schema: z.object({ id: z.string().min(1).max(40).describe('Trash item id from list_trash.') }),
  },
  {
    name: 'delete_from_trash',
    description: 'Permanently delete one trash item. Cannot be undone: the user is asked to confirm first.',
    schema: z.object({ id: z.string().min(1).max(40) }),
    destructive: true,
  },
  {
    name: 'empty_trash',
    description: 'Permanently delete everything in the trash. Cannot be undone: the user is asked to confirm first.',
    schema: z.object({}),
    destructive: true,
  },
];
