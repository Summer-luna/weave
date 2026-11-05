import { Bot } from 'lucide-react';
import { AgentSettingCard } from '../components/settings/AgentSettingCard';
import { useAiSettingsController } from '../controllers/use-ai-settings-controller';

export function SettingsRoute() {
  const { query, settings, save, test } = useAiSettingsController();

  return (
    <div>
      <h1 className="page-title">设置</h1>

      <section className="mt-8">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink">
          <Bot size={19} className="text-accent" /> Agent
        </h2>
        <p className="mb-5 text-sm text-muted">
          配置 AI 助手使用的模型服务。保存后立即生效，AI 面板里可以在已配置的服务之间切换。留空的项会使用 <code className="inline-code">apps/server/.env</code>{' '}
          里的值。Key 只保存在你自己的数据库里，页面上只显示打码后的前后几位。
        </p>
        <p className="mb-5 rounded-lg bg-amber-soft/60 px-3 py-2 text-sm text-ink">
          应用没有登录功能：同一网络里能打开 Weave 的人也能打开这个页面并使用这些 Key。
        </p>
        {query.isPending && <p className="text-muted">加载中…</p>}
        {query.isError && <p className="text-danger">读取设置失败</p>}
        <div className="space-y-4">
          {settings.map((setting) => (
            <AgentSettingCard
              key={setting.provider}
              setting={setting}
              onSave={(changes) => save(setting.provider, changes)}
              onTest={() => test(setting.provider)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
