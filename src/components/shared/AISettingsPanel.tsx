'use client';
import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { useAIAssistance } from '@/components/providers/AIAssistanceProvider';
import type { AISettingsDraft } from '@/lib/ai-assistance';

export function AISettingsPanel({ admin }: { admin: boolean }) {
  const { adapter, deployment, settings, setSettings } = useAIAssistance();
  const [draft, setDraft] = React.useState<AISettingsDraft>({ enabled: false, baseUrl: '', apiKey: '', model: '', clearKey: false });
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState('');
  React.useEffect(() => { setDraft({ enabled: settings.enabled, baseUrl: settings.baseUrl ?? '', model: settings.model ?? '', apiKey: '', clearKey: false }); }, [settings]);
  if (deployment === 'opensource' && !admin) return null;
  return <section className="yj-panel space-y-4 p-5">
    <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent-fg" /><h3 className="text-base font-medium">AI 辅助判读</h3></div>
    {deployment === 'saas' ? <><p className="text-sm text-fg-muted">平台默认开启，API 端点、Key 和模型由平台管理员在 Cuttlefish 配置。HPO、ACMG 和 CNV 每次生成消耗 1 积分。</p><p className="text-xs text-fg-muted">{settings.connected ? settings.configured ? '平台 AI 已配置' : '平台 AI 尚未配置' : 'AI 服务待接入'}</p></> : <>
      <p className="text-sm text-fg-muted">管理员配置服务端 API 后，开启 AI 辅助功能即可使用 HPO、ACMG 和 CNV 生成。</p>
      {!settings.connected && <p className="rounded bg-canvas-subtle p-3 text-xs text-fg-muted">配置接口待接入。当前填写仅为表单草稿，尚不能保存或启用服务。</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />启用 AI 辅助功能</label>
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 text-sm">API 端点<input className="mt-1 w-full rounded-md border border-border-default bg-canvas-default px-3 py-2" type="url" value={draft.baseUrl} onChange={event => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://your-provider.example/v1" autoComplete="off" /></label>
        <label className="text-sm">API Key<input className="mt-1 w-full rounded-md border border-border-default bg-canvas-default px-3 py-2" type="password" value={draft.apiKey} onChange={event => setDraft({ ...draft, apiKey: event.target.value })} placeholder={settings.keyConfigured ? '已配置，留空保持原值' : '输入 API Key'} autoComplete="new-password" /></label>
        <label className="text-sm">模型<input className="mt-1 w-full rounded-md border border-border-default bg-canvas-default px-3 py-2" value={draft.model} onChange={event => setDraft({ ...draft, model: event.target.value })} placeholder="模型名称" autoComplete="off" /></label>
      </div>
      {settings.keyConfigured && <label className="flex items-center gap-2 text-xs text-fg-muted"><input type="checkbox" checked={draft.clearKey} onChange={event => setDraft({ ...draft, clearKey: event.target.checked })} />清除已保存的 Key</label>}
      <p className="text-xs text-fg-muted">Key 不回显、不写入浏览器存储。</p>
      <button type="button" disabled={busy || !settings.connected || (draft.enabled && (!draft.baseUrl.trim() || !draft.model.trim() || (!draft.apiKey.trim() && !settings.keyConfigured)))} className="inline-flex items-center justify-center rounded-md bg-accent-emphasis px-3 py-2 text-sm font-medium text-fg-on-emphasis disabled:opacity-40 disabled:opacity-40" onClick={async () => {
        setBusy(true); setMessage(''); try { const saved = await adapter.saveSettings(draft); setSettings(saved); setDraft(previous => ({ ...previous, apiKey: '', clearKey: false })); setMessage('AI 配置已保存'); } catch (cause) { setMessage(cause instanceof Error ? cause.message : '保存失败'); } finally { setBusy(false); }
      }}>{busy ? '保存中…' : '保存 AI 配置'}</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </>}
  </section>;
}
