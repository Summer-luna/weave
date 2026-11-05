import { useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';
import { FilePlus2, FileText, Search, Text } from 'lucide-react';
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { toPlainText } from '../../controllers/use-content-view';
import { useSearchController } from '../../controllers/use-search-controller';

interface Result {
  key: string;
  kind: 'create' | 'page' | 'block';
  label: string;
  detail?: string;
  pageTitle: string;
}

export function SearchDialog({ onClose }: { onClose(): void }) {
  const [input, setInput] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { q, pages, blocks, canCreate } = useSearchController(input);

  const results = useMemo<Result[]>(() => {
    const list: Result[] = [];
    if (canCreate) list.push({ key: 'create', kind: 'create', label: `新建页面「${q}」`, pageTitle: q });
    for (const page of pages) list.push({ key: `p:${page.id}`, kind: 'page', label: page.title, pageTitle: page.title });
    for (const block of blocks)
      list.push({ key: `b:${block.id}`, kind: 'block', label: toPlainText(block.content), detail: block.pageTitle, pageTitle: block.pageTitle });
    return list;
  }, [q, pages, blocks, canCreate]);

  useEffect(() => setActive(0), [q]);

  const open = (result: Result | undefined) => {
    if (!result) return;
    onClose();
    void navigate({ to: '/page/$title', params: { title: result.pageTitle } });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      open(results[active]);
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-3 pt-3 backdrop-blur-[2px] md:px-4 md:pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-muted" />
          <input
            autoFocus
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索页面和笔记，或输入新页面标题"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">输入关键字开始搜索</li>}
          {results.map((result, index) => (
            <li key={result.key}>
              <button
                type="button"
                className={clsx('flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left', index === active && 'bg-accent-soft')}
                onMouseEnter={() => setActive(index)}
                onClick={() => open(result)}
              >
                {result.kind === 'create' ? (
                  <FilePlus2 size={16} className="mt-0.5 shrink-0 text-accent" />
                ) : result.kind === 'page' ? (
                  <FileText size={16} className="mt-0.5 shrink-0 text-muted" />
                ) : (
                  <Text size={16} className="mt-0.5 shrink-0 text-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-ink">{result.label}</span>
                  {result.detail && <span className="block truncate text-xs text-muted">{result.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
