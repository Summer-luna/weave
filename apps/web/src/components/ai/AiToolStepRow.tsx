import clsx from 'clsx';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { describeToolStep } from '../../controllers/use-content-view';
import type { AiToolStep } from '../../types/models';

interface AiToolStepRowProps {
  step: AiToolStep;
  onConfirm(approved: boolean): void;
}

export function AiToolStepRow({ step, onConfirm }: AiToolStepRowProps) {
  const [expanded, setExpanded] = useState(false);
  const label = describeToolStep(step.name, step.input);

  if (step.status === 'confirm') {
    return (
      <li className="rounded-lg border border-danger/40 bg-danger/5 p-2 text-sm">
        <p className="flex items-center gap-1.5 font-medium text-danger">
          <AlertTriangle size={14} /> 需要你确认：{label}
        </p>
        <p className="mt-1 text-xs text-muted">这个操作不能撤销。</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="rounded-md bg-danger px-3 py-1 text-xs font-medium text-white" onClick={() => onConfirm(true)}>
            确认执行
          </button>
          <button type="button" className="rounded-md border border-line px-3 py-1 text-xs" onClick={() => onConfirm(false)}>
            取消
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="text-xs text-muted">
      <button type="button" className="flex w-full items-center gap-1.5 text-left hover:text-ink" onClick={() => setExpanded((v) => !v)}>
        {step.status === 'running' ? (
          <Loader2 size={13} className="shrink-0 animate-spin" />
        ) : step.status === 'ok' ? (
          <Check size={13} className="shrink-0 text-accent" />
        ) : (
          <X size={13} className="shrink-0 text-danger" />
        )}
        <span className={clsx('truncate', step.status === 'error' && 'text-danger')}>{label}</span>
      </button>
      {expanded && step.output && (
        <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-black/[0.04] p-2 text-[11px] leading-snug whitespace-pre-wrap">{step.output}</pre>
      )}
    </li>
  );
}
