import { Link } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { usePageListController } from '../controllers/use-page-list-controller';

const formatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export function AllPagesRoute() {
  const [filter, setFilter] = useState('');
  const { query, deletePage } = usePageListController(filter.trim(), 1000);
  const pages = query.data ?? [];

  return (
    <div>
      <h1 className="page-title">全部页面</h1>
      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="按标题筛选…"
        className="mt-6 mb-4 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 font-medium">标题</th>
            <th className="hidden w-16 py-2 text-right font-medium md:table-cell">块</th>
            <th className="w-20 py-2 text-right font-medium">被引用</th>
            <th className="hidden w-44 py-2 text-right font-medium md:table-cell">最后编辑</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id} className="group border-b border-line/60 hover:bg-panel">
              <td className="py-2 pr-4">
                <Link to="/page/$title" params={{ title: page.title }} className="text-ink hover:text-accent">
                  {page.title}
                </Link>
              </td>
              <td className="hidden py-2 text-right tabular-nums text-muted md:table-cell">{page.blockCount}</td>
              <td className="py-2 text-right tabular-nums text-muted">{page.refCount}</td>
              <td className="hidden py-2 text-right text-muted md:table-cell">{formatter.format(new Date(page.updatedAt))}</td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  className="invisible rounded p-1 text-muted group-hover:visible pointer-coarse:visible hover:bg-danger/10 hover:text-danger"
                  title="删除页面"
                  onClick={() => {
                    if (confirm(`删除页面「${page.title}」和它的全部内容？其他页面里的链接文字会保留。`)) void deletePage(page.id, page.title);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!query.isPending && pages.length === 0 && <p className="py-10 text-center text-muted">没有页面</p>}
    </div>
  );
}
