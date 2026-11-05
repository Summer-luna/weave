const LABELS: Record<string, string> = {
  search_notes: '全库检索',
  search_pages: '搜索页面',
  search_blocks: '搜索笔记',
  read_page: '读取页面',
  read_block: '读取块',
  create_page: '新建页面',
  insert_blocks: '插入块',
  update_block: '修改块',
  move_block: '移动块',
  delete_block: '删除块',
  rename_page: '重命名页面',
  delete_page: '删除页面',
  set_page_starred: '收藏设置',
  add_page_tags: '添加标签',
  link_unlinked_mentions: '链接未链接提及',
};

const clip = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max)}…` : text);

export class AiToolDescriber {
  describe(name: string, input: unknown): string {
    const label = LABELS[name] ?? name;
    const args = (input ?? {}) as Record<string, unknown>;
    const detail =
      name === 'search_notes' && Array.isArray(args.keywords)
        ? args.keywords.join('、')
        : name === 'rename_page'
        ? `${args.title} → ${args.new_title}`
        : name === 'add_page_tags' && Array.isArray(args.tags)
          ? `${args.title}：${args.tags.join('、')}`
          : name === 'update_block' && typeof args.content === 'string'
            ? clip(args.content)
            : name === 'insert_blocks' && Array.isArray(args.blocks)
              ? `${args.page_title}（${args.blocks.length} 块）`
              : (args.title ?? args.page_title ?? args.query ?? args.id);
    return detail ? `${label} · ${clip(String(detail), 60)}` : label;
  }
}

export const aiToolDescriber = new AiToolDescriber();
