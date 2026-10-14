'use client';
import * as React from 'react';
import { Tooltip } from '@schema/ui-kit';
import { useText } from '@/i18n/useText';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

export function ResearchUseBadge() {
  return <Tooltip content="Research Use Only"><span tabIndex={0} aria-label="RUO — Research Use Only" className="inline-flex shrink-0 rounded-md border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-bold tracking-wider text-amber-900 dark:bg-amber-950 dark:text-amber-100">RUO</span></Tooltip>;
}
export function RetentionNotice({kind}: {kind:'task'|'sample'}) {
  const t = useText();
  if (getRuntimeBackendFlavor() !== 'squid') return null;
  return <aside role="note" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{t(kind === 'task' ? 'research.taskRetention' : 'research.sampleRetention')}</aside>;
}
export function SampleIdentityNotice({checked,onChange}: {checked:boolean;onChange:(value:boolean)=>void}) {
  const t = useText();
  return <div className="mb-4 space-y-3"><RetentionNotice kind="sample" /><aside role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{t('research.identityNotice')}</aside><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="mt-1 shrink-0" />{t('research.identityConfirm')}</label></div>;
}
export function ExpiryCell({value}: {value?:string}) {
  const t = useText();
  return <span className="whitespace-nowrap text-xs tabular-nums text-fg-muted">{value ? new Date(value).toLocaleString(t.locale,{hour12:false}) : '—'}</span>;
}
export function SelfHostedOnly({children}: {children:React.ReactNode}) {
  const t = useText();
  return getRuntimeBackendFlavor() === 'squid' ? <div role="note" className="p-8 text-sm text-fg-muted">{t('research.unavailable')}</div> : children;
}
