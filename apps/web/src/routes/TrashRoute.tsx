import { Link } from '@tanstack/react-router';
import { FileText, RotateCcw, Text, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTrashController } from '../controllers/use-trash-controller';

const formatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export function TrashRoute() {
  const trash = useTrashController();
  const [notice, setNotice] = useState<{ ok: boolean; text: string; pageTitle?: string } | null>(null);

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="page-title flex-1">回收站</h1>
        {trash.items.length > 0 && (
          <button
            type="button"
            className="chip hover:border-danger/50 hover:text-danger"
            onClick={() => {
              if (!confirm('永久删除回收站里的全部内容？这一步不能撤销。')) return;
              void trash.clear().then((r) => setNotice(r.ok ? { ok: true, text: '回收站已清空' } : { ok: false, text: r.message }));
            }}
          >
            清空回收站
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">删除的页面和有内容的块会在这里保留，最多保留最近 500 条。</p>
      {notice && (
        <p className={notice.ok ? 'mt-4 text-sm text-accent' : 'mt-4 text-sm text-danger'}>
          {notice.text}
          {notice.pageTitle && (
            <>
              {' '}
              <Link to="/page/$title" params={{ title: notice.pageTitle }} className="page-link">
                打开「{notice.pageTitle}」
              </Link>
            </>
          )}
        </p>
      )}
      {trash.query.isPending && <p className="mt-6 text-muted">加载中…</p>}
      {!trash.query.isPending && trash.items.length === 0 && <p className="mt-10 text-center text-muted">回收站是空的</p>}
      <ul className="mt-6 space-y-2">
        {trash.items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3">
            {item.kind === 'page' ? <FileText size={17} className="mt-0.5 shrink-0 text-muted" /> : <Text size={17} className="mt-0.5 shrink-0 text-muted" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{item.label || '（无文字）'}</p>
              <p className="mt-0.5 text-xs text-muted">
                {item.kind === 'page' ? `页面 · ${item.blockCount} 个块` : `来自「${item.pageTitle}」 · ${item.blockCount} 个块`} ·{' '}
                {formatter.format(new Date(item.deletedAt))}
              </p>
            </div>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink hover:border-accent hover:text-accent"
              onClick={() =>
                void trash.restore(item.id).then((r) =>
                  setNotice(r.ok ? { ok: true, text: '已恢复', pageTitle: r.value.pageTitle } : { ok: false, text: r.message }),
                )
              }
            >
              <RotateCcw size={13} /> 恢复
            </button>
            <button
              type="button"
              className="icon-button h-7 w-7 hover:text-danger"
              title="永久删除"
              onClick={() => {
                if (confirm('永久删除这一项？这一步不能撤销。')) void trash.remove(item.id);
              }}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
