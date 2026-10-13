'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton } from '@/components/shared/ActionButton';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { useAIAssistance } from '@/components/providers/AIAssistanceProvider';
import type { AISettingsDraft } from '@/lib/ai-assistance';

export function AISettingsPanel({ admin }: { admin: boolean }) {
  const t = useText();
  const { adapter, deployment, settings, setSettings } = useAIAssistance();
  const [draft, setDraft] = React.useState<AISettingsDraft>({ enabled: false, baseUrl: '', apiKey: '', model: '', clearKey: false });
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState('');
  React.useEffect(() => { setDraft({ enabled: settings.enabled, baseUrl: settings.baseUrl ?? '', model: settings.model ?? '', protocol: settings.protocol ?? 'openai_responses', apiKey: '', clearKey: false }); }, [settings]);
  if (deployment === 'opensource' && !admin) return null;
  return <section className="yj-panel space-y-4 p-5">
    <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent-fg" /><h3 className="text-base font-medium">{t("assistance.aiAssistedInterpretation5c2a7d")}</h3></div>
    {deployment === 'saas' ? <><p className="text-sm text-fg-muted">{t("assistance.platformAdministratorsConfigureTheApiUrlKey960cb6")}{settings.billingEnabled ? t("assistance.eachHpoAcmgOrCnvGenerationCosts8430e3") : t("assistance.noChargeDuringIntegrationTesting963f83")}</p><p className="text-xs text-fg-muted">{settings.connected ? settings.configured ? t("assistance.platformAiConfiguredfec514") : t("assistance.platformAiNotConfigured089ca5") : t("assistance.aiServiceUnavailable6c7c68")}</p></> : <>
      <p className="text-sm text-fg-muted">{t("assistance.afterAdministratorsConfigureTheServerApiEnable39d6cb")}</p>
      {!settings.connected && <p className="rounded bg-canvas-subtle p-3 text-xs text-fg-muted">{t("assistance.configurationApiIsNotConnectedCurrentInputed55c8")}</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />{t("assistance.enableAiAssistanceb03ac2")}</label>
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 text-sm">{t("assistance.apiUrl79593c")}<input className="mt-1 w-full rounded-md border border-border-default bg-canvas-default px-3 py-2" type="url" value={draft.baseUrl} onChange={event => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://your-provider.example/v1" autoComplete="off" /></label>
        <label className="text-sm"> {t("interface.apiKey47acd2")} <input className="mt-1 w-full rounded-md border border-border-default bg-canvas-default px-3 py-2" type="password" value={draft.apiKey} onChange={event => setDraft({ ...draft, apiKey: event.target.value })} placeholder={settings.keyConfigured ? t("assistance.configuredLeaveBlankToKeepebc3f7") : t("assistance.enterApiKey1bbd8d")} autoComplete="new-password" /></label>
        <label className="text-sm">{t("assistance.model98fd0c")}<input className="mt-1 w-full rounded-md border border-border-default bg-canvas-default px-3 py-2" value={draft.model} onChange={event => setDraft({ ...draft, model: event.target.value })} placeholder={t("assistance.modelName38719c")} autoComplete="off" /></label>
        <label className="text-sm">{t("assistance.modelProtocolbf54a5")}<select className="mt-1 w-full rounded-md border border-border-default bg-canvas-default px-3 py-2" value={draft.protocol ?? 'openai_responses'} onChange={event => setDraft({ ...draft, protocol: event.target.value as AISettingsDraft['protocol'] })}><option value="openai_responses">OpenAI Responses</option><option value="openai_chat">OpenAI Chat Completions</option></select></label>
      </div>
      {settings.keyConfigured && <label className="flex items-center gap-2 text-xs text-fg-muted"><input type="checkbox" checked={draft.clearKey} onChange={event => setDraft({ ...draft, clearKey: event.target.checked })} />{t("assistance.clearSavedKeyf1a538")}</label>}
      <p className="text-xs text-fg-muted">{t("assistance.keysAreNotDisplayedOrSavedInf06fdf")}</p>
      <ActionButton loading={busy} loadingLabel={t("tasks.saving6644f0")} action="save" variant="ghost" type="button" disabled={busy || !settings.connected || (draft.enabled && (!draft.baseUrl.trim() || !draft.model.trim() || (!draft.apiKey.trim() && !settings.keyConfigured)))} className="inline-flex items-center justify-center rounded-md bg-accent-emphasis px-3 py-2 text-sm font-medium text-fg-on-emphasis disabled:opacity-40 disabled:opacity-40" onClick={async () => {
        setBusy(true); setMessage(''); try { const saved = await adapter.saveSettings(draft); setSettings(saved); setDraft(previous => ({ ...previous, apiKey: '', clearKey: false })); setMessage(t("assistance.aiSettingsSaved5932f7")); } catch (cause) { setMessage(cause instanceof Error ? errorText(cause, t) : t("tasks.saveFailed40525a")); } finally { setBusy(false); }
      }}>{t("assistance.saveAiSettings77c9c8")}</ActionButton>
      {message && <p role="status" className="text-sm">{message}</p>}
    </>}
  </section>;
}
