import clsx from 'clsx';
import { PanelLeft, PanelRight, Search, Sparkles } from 'lucide-react';

interface TopBarProps {
  leftOpen: boolean;
  rightOpen: boolean;
  rightCount: number;
  aiOpen: boolean;
  onToggleAi(): void;
  onToggleLeft(): void;
  onToggleRight(): void;
  onSearch(): void;
}

export function TopBar({ leftOpen, rightOpen, rightCount, aiOpen, onToggleAi, onToggleLeft, onToggleRight, onSearch }: TopBarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line/70 px-3">
      <button type="button" className="icon-button" onClick={onToggleLeft} title={leftOpen ? '收起左侧栏（Ctrl+\\）' : '展开左侧栏（Ctrl+\\）'}>
        <PanelLeft size={17} />
      </button>
      <button type="button" className="topbar-search" onClick={onSearch}>
        <Search size={15} />
        <span className="hidden flex-1 text-left md:inline">搜索或新建页面</span>
        <kbd className="hidden md:inline">Ctrl K</kbd>
      </button>
      <div className="flex-1" />
      <button type="button" className={clsx('icon-button', aiOpen && 'bg-accent-soft text-accent')} onClick={onToggleAi} title="AI 助手（Ctrl+J）">
        <Sparkles size={17} />
      </button>
      <button
        type="button"
        className={clsx('icon-button relative', rightOpen && 'text-accent')}
        onClick={onToggleRight}
        disabled={rightCount === 0 && !aiOpen}
        title={rightCount === 0 ? 'Shift+点击链接或圆点，在右侧栏打开' : '显示 / 隐藏右侧栏（Ctrl+Shift+\\）'}
      >
        <PanelRight size={17} />
        {rightCount > 0 && <span className="badge">{rightCount}</span>}
      </button>
    </div>
  );
}
