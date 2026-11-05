import clsx from 'clsx';
import type { ThemeId } from '../../types/theme';

const THEMES: { id: ThemeId; title: string; description: string; swatches: string[] }[] = [
  { id: 'paper', title: '暖纸', description: '原来的米色纸张和墨绿强调色。', swatches: ['#f7f4ee', '#efebe3', '#1f6f69'] },
  { id: 'things-light', title: 'Things 浅色', description: '白底、浅灰侧栏、蓝色强调。', swatches: ['#ffffff', '#f5f6f8', '#2f7cf6'] },
  { id: 'things-dark', title: 'Things 深色', description: '深灰底、柔和的亮蓝强调。', swatches: ['#1e1f22', '#26282b', '#4c9aff'] },
  { id: 'system', title: '跟随系统', description: '系统浅色时用 Things 浅色，深色时用 Things 深色。', swatches: ['#ffffff', '#1e1f22', '#2f7cf6'] },
];

interface ThemeCardProps {
  theme: ThemeId;
  onChange(theme: ThemeId): void;
}

export function ThemeCard({ theme, onChange }: ThemeCardProps) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-ink">主题</h3>
        <p className="mt-0.5 text-sm text-muted">只保存在这个浏览器里，换设备需要重新选。</p>
      </header>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4" role="radiogroup" aria-label="主题">
        {THEMES.map(({ id, title, description, swatches }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={theme === id}
            onClick={() => onChange(id)}
            className={clsx(
              'rounded-lg border px-3 py-2.5 text-left transition-colors',
              theme === id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-ink/5',
            )}
          >
            <span className="mb-2 flex gap-1">
              {swatches.map((color) => (
                <span key={color} className="h-5 w-5 rounded-full border border-ink/15" style={{ backgroundColor: color }} />
              ))}
            </span>
            <span className={clsx('block text-sm font-medium', theme === id ? 'text-accent' : 'text-ink')}>{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
