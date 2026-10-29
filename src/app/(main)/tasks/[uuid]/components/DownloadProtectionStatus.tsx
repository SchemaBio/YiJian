'use client';
import * as React from 'react';
import { api } from '@/lib/api';
import { useText } from '@/i18n/useText';
import { errorText } from '@/i18n/errors';

export interface ProtectedDownloadGrant {
  id: string; protection_version?: number; bound_ip?: string; observed_bytes?: number;
  traffic_threshold_bytes?: number; usage_synced_at?: string; issuance_state?: string;
  network_request?: { status: string; target_ip: string; not_before?: string };
}
export function DownloadProtectionStatus({ taskId, grant, onUpdated, onRepurchase }: {
  taskId: string; grant: ProtectedDownloadGrant; onUpdated: () => void; onRepurchase?: () => void;
}) {
  const t = useText(); const [busy, setBusy] = React.useState(false); const [notice, setNotice] = React.useState('');
  if (!grant.protection_version) return null;
  const state = grant.issuance_state || 'active';
  const bytes = (value?: number) => ((value || 0) / 1_000_000_000).toLocaleString(t.locale, { maximumFractionDigits: 3 }) + ' GB';
  async function request() {
    if (busy) return; setBusy(true); setNotice('');
    try { await api.post(`/v1/tasks/${encodeURIComponent(taskId)}/downloads/network-requests`, { grant_id: grant.id }); setNotice(t('downloadProtection.requestSent')); onUpdated(); }
    catch (e) { setNotice(errorText(e, t)); } finally { setBusy(false); }
  }
  return <div className="mt-2 space-y-2 rounded border border-border-default p-3 text-xs">
    <p>{t('downloadProtection.boundIP', { p0: grant.bound_ip || '—' })}</p>
    <p>{t('downloadProtection.usage', { p0: bytes(grant.observed_bytes), p1: bytes(grant.traffic_threshold_bytes) })}</p>
    <p>{t('downloadProtection.synced', { p0: grant.usage_synced_at ? new Date(grant.usage_synced_at).toLocaleString(t.locale) : t('downloadProtection.noObservation') })}</p>
    <p>{t('downloadProtection.delay')}</p><p>{t('downloadProtection.state.' + state)}</p>
    {grant.network_request && <p>{t('downloadProtection.network.' + grant.network_request.status)} · {grant.network_request.target_ip}{grant.network_request.not_before && <> · {new Date(grant.network_request.not_before).toLocaleString(t.locale)}</>}</p>}
    {state === 'active' && !['pending', 'approved_wait'].includes(grant.network_request?.status || '') && <button className="underline" disabled={busy} onClick={() => void request()}>{t('downloadProtection.requestNetwork')}</button>}
    {state === 'threshold' && onRepurchase && <button className="underline" onClick={onRepurchase}>{t('downloadProtection.repurchase')}</button>}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
