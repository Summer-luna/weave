import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import { Eraser, Send, Sparkles, Square, Undo2, X } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useAiChatController } from '../../controllers/use-ai-chat-controller';
import { RichContent } from '../content/RichContent';
import type { AiProviderId } from '../../types/models';
import { AiToolStepRow } from './AiToolStepRow';

export function AiPanel() {
  const ai = useAiChatController();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [ai.items]);

  const submit = () => {
    if (!draft.trim() || ai.running) return;
    void ai.send(draft);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const noProvider = !ai.providersLoading && !ai.activeProvider;

  return (
    <section className="ai-panel">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Sparkles size={16} className="text-accent" />
        <span className="text-sm font-semibold text-ink">AI 助手</span>
        <select
          className="ml-auto rounded-md border border-line bg-panel px-1.5 py-0.5 text-xs text-ink outline-none"
          value={ai.activeProvider?.id ?? ''}
          disabled={ai.running || !ai.activeProvider}
          onChange={(event) => ai.setProvider(event.target.value as AiProviderId)}
          title={ai.activeProvider ? `模型：${ai.activeProvider.model}` : undefined}
        >
          {ai.providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.configured}>
              {p.label}
              {p.configured ? '' : '（未配置）'}
            </option>
          ))}
        </select>
        <button type="button" className="icon-button h-7 w-7" onClick={ai.clear} disabled={ai.running || ai.items.length === 0} title="清空对话">
          <Eraser size={15} />
        </button>
        <button type="button" className="icon-button h-7 w-7" onClick={ai.close} title="关闭 AI 助手">
          <X size={15} />
        </button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 text-[14.5px] leading-relaxed">
        {noProvider && (
          <p className="rounded-lg bg-amber-soft/60 p-3 text-sm text-ink">
            还没有可用的模型服务。到{' '}
            <Link to="/settings" className="page-link">
              设置 → Agent
            </Link>{' '}
            里填写 API Key。
          </p>
        )}
        {ai.items.length === 0 && !noProvider && (
          <div className="space-y-3 text-sm text-muted">
            <p>
              我可以读写你的笔记：搜索、总结、加标签和双链、整理结构。当前页面：<span className="text-ink">{ai.pageTitle}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {ai.presets.map((preset) => (
                <button key={preset.key} type="button" className="chip" onClick={() => ai.runPreset(preset.key)}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {ai.items.map((item) =>
          item.role === 'user' ? (
            <div key={item.id} className="ml-6 rounded-xl bg-accent-soft/70 px-3 py-2 whitespace-pre-wrap text-ink">
              {item.text}
            </div>
          ) : (
            <div key={item.id} className="space-y-2">
              {item.parts.map((part, index) => {
                if (part.kind === 'text') {
                  return part.text.trim() ? (
                    <div key={index} className="whitespace-pre-wrap text-ink">
                      <RichContent content={part.text.trim()} />
                    </div>
                  ) : null;
                }
                const step = item.steps.find((s) => s.id === part.id);
                return step ? (
                  <ul key={index}>
                    <AiToolStepRow step={step} onConfirm={(approved) => void ai.confirm(step.id, approved)} />
                  </ul>
                ) : null;
              })}
              {item.status === 'streaming' && !item.text && item.steps.length === 0 && <p className="text-sm text-muted">思考中…</p>}
              {item.undo && item.undo !== 'done' && (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-50"
                  disabled={item.undo === 'running'}
                  onClick={() => void ai.undoRun(item.id)}
                >
                  <Undo2 size={13} /> {item.undo === 'running' ? '撤销中…' : '撤销这次改动'}
                </button>
              )}
              {item.notices.map((notice, index) => (
                <p key={index} className="text-xs text-muted">
                  {notice}
                </p>
              ))}
              {item.error && <p className="rounded-md bg-danger/10 px-2 py-1 text-sm text-danger">出错了：{item.error}</p>}
            </div>
          ),
        )}
      </div>

      <div className="border-t border-line p-2">
        <div className="mb-1.5 flex items-center gap-1 text-xs">
          <span className="text-muted">回答范围</span>
          {(['page', 'library'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              disabled={ai.running}
              onClick={() => ai.setScope(scope)}
              className={clsx('rounded-full px-2 py-0.5', ai.scope === scope ? 'bg-accent text-white' : 'text-muted hover:bg-ink/5')}
            >
              {scope === 'page' ? '当前页' : '全库'}
            </button>
          ))}
        </div>
        <div className={clsx('flex items-end gap-2 rounded-xl border bg-panel px-2 py-1.5', 'border-line focus-within:border-accent/60')}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            disabled={noProvider}
            placeholder="让 AI 帮你整理、总结、加链接…（Enter 发送）"
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {ai.running ? (
            <button type="button" className="icon-button h-8 w-8 text-danger" onClick={ai.stop} title="停止">
              <Square size={15} fill="currentColor" />
            </button>
          ) : (
            <button type="button" className="icon-button h-8 w-8 text-accent" onClick={submit} disabled={!draft.trim() || noProvider} title="发送">
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
