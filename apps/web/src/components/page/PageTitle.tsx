import clsx from 'clsx';
import { Sparkles, Star } from 'lucide-react';
import { KeyboardEvent, useEffect, useState } from 'react';
import { describeDailyTitle } from '../../controllers/use-content-view';

interface PageTitleProps {
  title: string;
  error: string | null;
  busy: boolean;
  starred: boolean;
  onRename(title: string): Promise<boolean>;
  onToggleStar(): void;
  onAiOrganize(): void;
}

export function PageTitle({ title, error, busy, starred, onRename, onToggleStar, onAiOrganize }: PageTitleProps) {
  const [draft, setDraft] = useState(title);
  const subtitle = describeDailyTitle(title);

  useEffect(() => setDraft(title), [title]);

  const commit = async () => {
    if (draft.trim() === title) {
      setDraft(title);
      return;
    }
    const ok = await onRename(draft);
    if (!ok) setDraft(title);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(title);
      requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
    }
  };

  return (
    <header className="mb-6">
      {subtitle && <p className="mb-1 text-sm tracking-wide text-muted">{subtitle}</p>}
      <div className="group flex items-center gap-2">
        <input
          className="page-title"
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={onKeyDown}
          aria-label="页面标题"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onToggleStar}
          className={clsx('rounded-md p-1.5 transition hover:bg-ink/5', starred ? 'text-amber' : 'text-muted opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100')}
          title={starred ? '取消收藏' : '收藏到左侧栏'}
        >
          <Star size={20} fill={starred ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={onAiOrganize}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted opacity-0 transition group-hover:opacity-100 hover:bg-accent-soft hover:text-accent pointer-coarse:opacity-100"
          title="让 AI 给这一页加标签和双链"
        >
          <Sparkles size={16} /> <span className="hidden md:inline">AI 整理</span>
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </header>
  );
}
