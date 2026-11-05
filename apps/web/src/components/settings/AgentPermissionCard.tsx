import clsx from 'clsx';
import { Eye, PencilLine, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentPermissionLevel } from '../../types/models';

const LEVELS: { level: AgentPermissionLevel; title: string; description: string; icon: LucideIcon }[] = [
  { level: 'read', title: '只读', description: '只能搜索和阅读笔记，不做任何修改。', icon: Eye },
  { level: 'edit', title: '可编辑', description: '可以新建和修改页面、块、标签、模板、待办，也能从回收站恢复，但不能删除。', icon: PencilLine },
  { level: 'full', title: '完全', description: '在可编辑的基础上还能删除页面和块、永久删除或清空回收站。每次删除前仍会请你确认。', icon: ShieldAlert },
];

interface AgentPermissionCardProps {
  level: AgentPermissionLevel | undefined;
  saving: boolean;
  failed: boolean;
  onChange(level: AgentPermissionLevel): void;
}

export function AgentPermissionCard({ level, saving, failed, onChange }: AgentPermissionCardProps) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-ink">权限</h3>
        <p className="mt-0.5 text-sm text-muted">AI 助手能对笔记做哪些事。对所有模型服务生效，超出权限的工具 AI 根本看不到。</p>
      </header>
      <div className="grid gap-2 md:grid-cols-3" role="radiogroup" aria-label="AI 权限">
        {LEVELS.map(({ level: value, title, description, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={level === value}
            disabled={saving || level === undefined}
            onClick={() => onChange(value)}
            className={clsx(
              'rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-default',
              level === value ? 'border-accent bg-accent-soft' : 'border-line hover:bg-ink/5',
            )}
          >
            <span className={clsx('flex items-center gap-1.5 text-sm font-medium', level === value ? 'text-accent' : 'text-ink')}>
              <Icon size={15} /> {title}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{description}</span>
          </button>
        ))}
      </div>
      {failed && <p className="mt-3 text-sm text-danger">保存权限失败</p>}
    </section>
  );
}
