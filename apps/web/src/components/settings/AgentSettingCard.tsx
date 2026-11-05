import clsx from 'clsx';
import { CheckCircle2, CircleDashed, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiProviderId, AiSetting, UpdateAiSettingInput } from '../../types/models';

const HINTS: Record<AiProviderId, { title: string; description: string; baseUrl: string; model: string }> = {
  claude: {
    title: 'Claude',
    description: 'Anthropic 官方接口，或兼容 Anthropic 协议的第三方中转。',
    baseUrl: '留空使用官方地址；走中转时填中转地址',
    model: '例如 claude-opus-5-5',
  },
  openai: {
    title: 'Codex (OpenAI)',
    description: 'OpenAI 官方接口（Responses API）。',
    baseUrl: '留空使用官方地址',
    model: '例如 gpt-6-astra',
  },
  compatible: {
    title: 'OpenAI 兼容接口',
    description: '星诺这类第三方中转或其他兼容 OpenAI 协议（Chat Completions）的服务，三项都要填。',
    baseUrl: '例如 https://api.example.com/v1',
    model: '中转里的模型名，例如 claude-opus-5-5',
  },
};

interface AgentSettingCardProps {
  setting: AiSetting;
  onSave(changes: UpdateAiSettingInput): Promise<string | null>;
  onTest(): Promise<{ ok: boolean; message: string }>;
}

export function AgentSettingCard({ setting, onSave, onTest }: AgentSettingCardProps) {
  const hint = HINTS[setting.provider];
  const [label, setLabel] = useState(setting.label);
  const [baseUrl, setBaseUrl] = useState(setting.baseUrl);
  const [model, setModel] = useState(setting.model);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setLabel(setting.label);
    setBaseUrl(setting.baseUrl);
    setModel(setting.model);
  }, [setting.label, setting.baseUrl, setting.model]);

  const dirty = label !== setting.label || baseUrl !== setting.baseUrl || model !== setting.model || apiKey !== '';

  const save = async (changes: UpdateAiSettingInput) => {
    setBusy('save');
    const error = await onSave(changes);
    setBusy(null);
    setStatus(error ? { ok: false, message: error } : { ok: true, message: '已保存' });
    if (!error) setApiKey('');
  };

  const test = async () => {
    if (dirty) await save({ label, baseUrl, model, ...(apiKey ? { apiKey } : {}) });
    setBusy('test');
    setStatus(await onTest());
    setBusy(null);
  };

  const keyPlaceholder =
    setting.keySource === 'settings'
      ? `已保存 ${setting.keyPreview}（留空则不修改）`
      : setting.keySource === 'env'
        ? `正在使用 .env 里的 Key ${setting.keyPreview}`
        : '粘贴 API Key';

  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <header className="mb-4 flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-ink">{hint.title}</h3>
          <p className="mt-0.5 text-sm text-muted">{hint.description}</p>
        </div>
        <span
          className={clsx(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs',
            setting.configured ? 'bg-accent-soft text-accent' : 'bg-ink/5 text-muted',
          )}
        >
          {setting.configured ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
          {setting.configured ? `可用 · ${setting.effectiveModel}` : '未配置'}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="settings-field">
          <span>显示名称</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={setting.defaultLabel} />
        </label>
        <label className="settings-field">
          <span>模型</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={setting.defaultModel || hint.model} spellCheck={false} />
        </label>
        <label className="settings-field md:col-span-2">
          <span>Base URL</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={setting.defaultBaseUrl || hint.baseUrl} spellCheck={false} />
        </label>
        <label className="settings-field md:col-span-2">
          <span>API Key</span>
          <div className="flex items-center gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="flex-1"
            />
            <button type="button" className="icon-button" onClick={() => setShowKey((v) => !v)} title={showKey ? '隐藏' : '显示'}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={!dirty || busy !== null}
          onClick={() => void save({ label, baseUrl, model, ...(apiKey ? { apiKey } : {}) })}
        >
          {busy === 'save' ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-1.5 text-sm text-ink disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => void test()}
        >
          {busy === 'test' && <Loader2 size={14} className="animate-spin" />}
          测试连接
        </button>
        {setting.keySource === 'settings' && (
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-danger"
            disabled={busy !== null}
            onClick={() => void save({ apiKey: '' })}
          >
            清除已保存的 Key
          </button>
        )}
        {status && <span className={clsx('text-sm', status.ok ? 'text-accent' : 'text-danger')}>{status.message}</span>}
      </footer>
    </section>
  );
}
