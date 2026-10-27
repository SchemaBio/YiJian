'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { useAuth } from '@/components/providers/AuthProvider';
import { useText } from '@/i18n/useText';

export function ExampleBadge({ origin }: { origin?: string }) {
  const t = useText();
  if (getRuntimeBackendFlavor() !== 'squid' || origin !== 'example') return null;
  return <span className="ml-2 inline-flex rounded border border-border-default px-1.5 py-0.5 text-xs text-fg-muted">{t('exampleData.label')}</span>;
}
type Status = { status: string; sample_id?: string; task_id?: string; data_expires_at?: string; expires_at?: string };
export function ExampleDataNotice() {
  if (getRuntimeBackendFlavor() !== 'squid') return null;
  return <SaaSExampleDataNotice />;
}
function SaaSExampleDataNotice() {
  const t = useText(); const pathname = usePathname(); const { user, currentOrg } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const visible = ['/samples', '/data', '/tasks'].includes(pathname);
  useEffect(() => {
    setStatus(null);
    if (!isSaaS || !visible || !user || !currentOrg) return;
    const controller = new AbortController(); let active = true;
    const load = async () => {
      try { const value = await api.get<Status>('/v1/auth/example-data', { coreApi: true, signal: controller.signal, cache: 'no-store' }); if (active) setStatus(value); }
      catch { if (active) setStatus(null); }
    };
    void load(); const timer = window.setInterval(() => void load(), 30000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [isSaaS, visible, user?.id, currentOrg?.id]);
  if (!isSaaS || !visible || !status || ['not_selected', 'expired'].includes(status.status)) return null;
  const ready = status.status === 'ready';
  const dataExpired = status.data_expires_at && Date.now() >= Date.parse(status.data_expires_at);
  const date = (value?: string) => value ? new Date(value).toLocaleString(t.locale) : '—';
  return <section role="status" className="mx-4 mt-3 rounded-md border border-border-default bg-canvas-subtle px-4 py-3 text-sm text-fg-muted">
    <strong>{t('exampleData.label')}</strong>{' '}{t(ready ? 'exampleData.ready' : status.status === 'failed' ? 'exampleData.failed' : 'exampleData.preparing')}
    {ready && <><p>{t(dataExpired ? 'exampleData.dataExpired' : 'exampleData.deadlines', { p0: date(status.data_expires_at), p1: date(status.expires_at) })}</p><div className="mt-1 flex gap-4"><Link href={`/samples/${encodeURIComponent(status.sample_id || '')}`}>{t('exampleData.sample')}</Link><Link href={`/tasks/${encodeURIComponent(status.task_id || '')}`}>{t('exampleData.results')}</Link></div></>}
  </section>;
}
