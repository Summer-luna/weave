import clsx from 'clsx';
import type { CjkFont, CodeFont, FontSettings, LatinFont } from '../../types/font';

interface FontOption<T> {
  id: T;
  title: string;
  family: string;
}

const CJK: FontOption<CjkFont>[] = [
  { id: 'theme', title: '跟随主题', family: 'var(--font-base-cjk)' },
  { id: 'noto-sans-sc', title: '思源黑体', family: "'Noto Sans SC Variable'" },
  { id: 'lxgw-wenkai', title: '霞鹜文楷', family: "'LXGW WenKai'" },
];

const LATIN: FontOption<LatinFont>[] = [
  { id: 'theme', title: '跟随主题', family: 'var(--font-base-latin)' },
  { id: 'inter', title: 'Inter', family: "'Inter Variable'" },
  { id: 'ia-quattro', title: 'iA Writer Quattro', family: "'iA Writer Quattro'" },
  { id: 'atkinson', title: 'Atkinson Hyperlegible Next', family: "'Atkinson Hyperlegible Next Variable'" },
];

const CODE: FontOption<CodeFont>[] = [
  { id: 'system', title: '系统等宽', family: 'ui-monospace, monospace' },
  { id: 'jetbrains-mono', title: 'JetBrains Mono', family: "'JetBrains Mono Variable'" },
];

interface FontRowProps<T extends string> {
  label: string;
  sample: string;
  options: FontOption<T>[];
  value: T;
  onChange(value: T): void;
}

function FontRow<T extends string>({ label, sample, options, value, onChange }: FontRowProps<T>) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            onClick={() => onChange(option.id)}
            className={clsx(
              'rounded-lg border px-3 py-2 text-left transition-colors',
              value === option.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-ink/5',
            )}
          >
            <span className={clsx('block text-sm font-medium', value === option.id ? 'text-accent' : 'text-ink')}>{option.title}</span>
            <span className="mt-0.5 block truncate text-[15px] text-ink/80" style={{ fontFamily: option.family }}>
              {sample}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface FontCardProps {
  fonts: FontSettings;
  onChange(patch: Partial<FontSettings>): void;
}

export function FontCard({ fonts, onChange }: FontCardProps) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-ink">字体</h3>
        <p className="mt-0.5 text-sm text-muted">中文、英文和代码分开选。字体都打包在应用里，不需要联网。</p>
      </header>
      <div className="space-y-4">
        <FontRow label="中文" sample="温故知新" options={CJK} value={fonts.cjk} onChange={(cjk) => onChange({ cjk })} />
        <FontRow label="英文" sample="Quick fox 0123" options={LATIN} value={fonts.latin} onChange={(latin) => onChange({ latin })} />
        <FontRow label="代码" sample="x => [[a]];" options={CODE} value={fonts.code} onChange={(code) => onChange({ code })} />
      </div>
    </section>
  );
}
