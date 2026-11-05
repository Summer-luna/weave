import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { FileText, PanelRightClose, Text, X } from 'lucide-react';
import { useBlockRef } from '../../controllers/use-block-ref';
import { toPlainText } from '../../controllers/use-content-view';
import { useLayoutController } from '../../controllers/use-layout-controller';
import type { SidebarItem } from '../../types/models';
import { AiPanel } from '../ai/AiPanel';
import { PageView } from '../page/PageView';

export function RightSidebar({ overlay, onHide }: { overlay: boolean; onHide(): void }) {
  const layout = useLayoutController();
  return (
    <aside className={clsx('right-sidebar', overlay && 'fixed inset-0 z-40 w-full')}>
      {layout.aiOpen && (
        <div className={clsx('flex min-h-0 flex-col', layout.sidebar.length > 0 ? 'h-[58%] border-b border-line' : 'flex-1')}>
          <AiPanel />
        </div>
      )}
      {(layout.sidebar.length > 0 || !layout.aiOpen) && (
      <>
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line/70 px-4">
        <span className="flex-1 text-xs font-semibold tracking-wider text-muted uppercase">右侧栏</span>
        <button type="button" className="text-xs text-muted hover:text-ink" onClick={layout.closeAllSidebar}>
          全部关闭
        </button>
        <button type="button" className="icon-button" onClick={onHide} title="隐藏右侧栏">
          <PanelRightClose size={17} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {layout.sidebar.map((item) => {
          const key = layout.itemKey(item);
          return <SidebarPanel key={key} item={item} onClose={() => layout.closeSidebarItem(key)} />;
        })}
      </div>
      </>
      )}
    </aside>
  );
}

function SidebarPanel({ item, onClose }: { item: SidebarItem; onClose(): void }) {
  return (
    <section className="sidebar-panel">
      <header className="mb-2 flex items-center gap-2 text-xs text-muted">
        {item.kind === 'page' ? <FileText size={13} /> : <Text size={13} />}
        <span className="flex-1 truncate">{item.kind === 'page' ? '页面' : '块'}</span>
        <button type="button" className="rounded p-0.5 hover:bg-black/5 hover:text-ink" onClick={onClose} title="关闭">
          <X size={14} />
        </button>
      </header>
      {item.kind === 'page' ? <PageView title={item.title} variant="sidebar" /> : <BlockPanel id={item.id} />}
    </section>
  );
}

function BlockPanel({ id }: { id: string }) {
  const { data, isPending } = useBlockRef(id);
  if (isPending) return <p className="text-sm text-muted">加载中…</p>;
  if (!data) return <p className="text-sm text-danger">这个块已经不存在了。</p>;
  return (
    <>
      <Link to="/page/$title" params={{ title: data.pageTitle }} search={{ zoom: id }} className="mb-1 block truncate text-xs text-muted hover:text-accent">
        {data.pageTitle} · {toPlainText(data.content).slice(0, 40)}
      </Link>
      <PageView title={data.pageTitle} zoomId={id} variant="sidebar" />
    </>
  );
}
