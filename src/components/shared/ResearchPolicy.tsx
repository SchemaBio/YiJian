'use client';
import * as React from 'react';
import { Checkbox, Tooltip } from '@schema/ui-kit';
import { AlertTriangle } from 'lucide-react';
import { useText } from '@/i18n/useText';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

export function ResearchUseBadge() {
  const t = useText();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const label = isSaaS ? 'RUO' : t('research.selfHostedLabel');
  return <Tooltip content={t(isSaaS ? 'research.saasScope' : 'research.selfHostedScope')}><span tabIndex={0} aria-label={isSaaS ? 'RUO — Research Use Only' : label} className="inline-flex shrink-0 rounded-md border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-bold tracking-wider text-amber-900 dark:bg-amber-950 dark:text-amber-100">{label}</span></Tooltip>;
}

export function ProductScopeSection() {
  const t = useText();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  return (
    <section className="mb-4 yj-panel p-5">
      <h2 className="mb-2 text-sm font-medium text-fg-default">{t('research.title')}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-fg-muted">
        {isSaaS && <p>{t('research.audience')}</p>}
        <p>{t(isSaaS ? 'research.saasScope' : 'research.selfHostedScope')}</p>
        {isSaaS && <p>{t('research.saasDataScope')}</p>}
      </div>
    </section>
  );
}
export function RetentionNotice({kind}: {kind:'task'|'sample'}) {
  const t = useText();
  if (getRuntimeBackendFlavor() !== 'squid') return null;
  return (
    <aside role="note" className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
      <p>{t(kind === 'task' ? 'research.taskRetention' : 'research.sampleRetention')}</p>
    </aside>
  );
}
export function SampleIdentityNotice({checked,onChange}: {checked:boolean;onChange:(value:boolean)=>void}) {
  const t = useText();
  return (
    <aside role="note" className="mb-4 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-2">
          {getRuntimeBackendFlavor() === 'squid' && <p>{t('research.sampleRetention')}</p>}
          <p>{t('research.identityNotice')}</p>
        </div>
      </div>
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} label={t('research.identityConfirm')} />
    </aside>
  );
}
export function ExpiryCell({value}: {value?:string}) {
  const t = useText();
  return <span className="whitespace-nowrap text-xs tabular-nums text-fg-muted">{value ? new Date(value).toLocaleString(t.locale,{hour12:false}) : '—'}</span>;
}
export function SelfHostedOnly({children}: {children:React.ReactNode}) {
  const t = useText();
  return getRuntimeBackendFlavor() === 'squid' ? <div role="note" className="p-8 text-sm text-fg-muted">{t('research.unavailable')}</div> : children;
}
