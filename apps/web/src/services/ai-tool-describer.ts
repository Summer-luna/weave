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
  get_block_references: '查看块引用',
  list_daily_notes: '查看日历',
  list_templates: '列出模板',
  apply_template: '插入模板',
  set_todo: '设置待办',
  set_block_collapsed: '折叠 / 展开',
  list_trash: '查看回收站',
  restore_from_trash: '从回收站恢复',
  delete_from_trash: '永久删除',
  empty_trash: '清空回收站',
};

const TODO_STATES: Record<string, string> = { todo: '待办', done: '已完成', none: '普通块' };

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
              : name === 'apply_template'
                ? `${args.template_title} → ${args.page_title}`
                : name === 'set_todo' && typeof args.state === 'string'
                  ? TODO_STATES[args.state]
                  : name === 'set_block_collapsed'
                    ? args.collapsed ? '折叠' : '展开'
                    : (args.title ?? args.page_title ?? args.month ?? args.query ?? args.id);
    return detail ? `${label} · ${clip(String(detail), 60)}` : label;
  }
}

export const aiToolDescriber = new AiToolDescriber();
