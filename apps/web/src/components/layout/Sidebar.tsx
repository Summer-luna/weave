import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { CalendarDays, CalendarRange, FileText, Library, Settings, Star, Trash2 } from 'lucide-react';
import { usePageListController } from '../../controllers/use-page-list-controller';
import { useSaveStatus } from '../../controllers/use-save-status';
import { useStarredPages } from '../../controllers/use-star-controller';

export function Sidebar() {
  const { query } = usePageListController('', 12);
  const starred = useStarredPages();
  const { status, error } = useSaveStatus();

  return (
    <aside className="sidebar">
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <img src="/favicon.svg" alt="" className="h-6 w-6" />
        <span className="text-base font-semibold tracking-tight text-ink">Weave</span>
      </div>

      <nav className="mt-2 space-y-0.5">
        <Link to="/" className="sidebar-link" activeProps={{ className: 'active' }} activeOptions={{ exact: true }}>
          <CalendarDays size={16} /> 日记
        </Link>
        <Link to="/calendar" className="sidebar-link" activeProps={{ className: 'active' }}>
          <CalendarRange size={16} /> 日历
        </Link>
        <Link to="/pages" className="sidebar-link" activeProps={{ className: 'active' }}>
          <Library size={16} /> 全部页面
        </Link>
        <Link to="/trash" className="sidebar-link" activeProps={{ className: 'active' }}>
          <Trash2 size={16} /> 回收站
        </Link>
        <Link to="/settings" className="sidebar-link" activeProps={{ className: 'active' }}>
          <Settings size={16} /> 设置
        </Link>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <p className="sidebar-section">收藏</p>
        {(starred.data ?? []).length === 0 && <p className="px-3 text-xs leading-relaxed text-muted/80">在页面标题旁点星标，页面会固定在这里。</p>}
        <nav className="space-y-0.5">
          {(starred.data ?? []).map((page) => (
            <Link key={page.id} to="/page/$title" params={{ title: page.title }} className="sidebar-link" activeProps={{ className: 'active' }}>
              <Star size={14} className="shrink-0 text-amber" fill="currentColor" />
              <span className="truncate">{page.title}</span>
            </Link>
          ))}
        </nav>

        <p className="sidebar-section">最近编辑</p>
        <nav className="space-y-0.5">
          {(query.data ?? []).map((page) => (
            <Link key={page.id} to="/page/$title" params={{ title: page.title }} className="sidebar-link" activeProps={{ className: 'active' }}>
              <FileText size={15} className="shrink-0 opacity-60" />
              <span className="truncate">{page.title}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-line px-3 py-3 text-xs text-muted" title={error?.message}>
        <span className={clsx('mr-1.5 inline-block h-2 w-2 rounded-full', status === 'saving' ? 'bg-amber' : status === 'error' ? 'bg-danger' : 'bg-accent')} />
        {status === 'saving' ? '保存中…' : status === 'error' ? `保存失败：${error?.message ?? ''}` : '已保存'}
      </div>
    </aside>
  );
}
