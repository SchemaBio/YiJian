'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useText } from '@/i18n/useText';
import { LanguageSwitcher } from './LanguageSwitcher';
import { getServicePolicy, SERVICE_POLICY_VERSION, type ServicePolicy } from '@/lib/service-policy';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import type { Locale } from '@/i18n/locales';
import copy from '@/i18n/service-policy-v1.json';

export function ServicePolicyLinks({ locale }: { locale?: Locale } = {}) {
  const t = useText(); const selectedLocale = locale ?? t.locale; const c = copy[selectedLocale];
  if (getRuntimeBackendFlavor() !== 'squid') return null;
  return <nav aria-label={c.navigation} className="flex flex-wrap justify-center gap-4 text-sm text-accent-fg">
    {(['service', 'terms', 'refund'] as const).map(kind => <Link key={kind} href={`/${kind}?lang=${selectedLocale}&version=${SERVICE_POLICY_VERSION}`} className="underline">{c[kind].title}</Link>)}
  </nav>;
}

export function ServicePolicyDocument({ kind, locale, version, initialPolicy }: { initialPolicy?: ServicePolicy | null; kind: 'service' | 'terms' | 'refund'; locale: Locale; version?: string }) {
  const c = copy[locale]; const [policy, setPolicy] = useState<ServicePolicy | null>(initialPolicy ?? null);
  useEffect(() => { if (version && version !== SERVICE_POLICY_VERSION) return; let active = true; if (getRuntimeBackendFlavor() === 'squid') void getServicePolicy().then(p => { if (active) setPolicy(p); }).catch(() => undefined); return () => { active = false; }; }, [version]);
  const supported = !version || version === SERVICE_POLICY_VERSION;
  return <main className="yj-modern yj-public-shell min-h-screen px-4 py-10" lang={locale}>
    <LanguageSwitcher locale={locale} policy />
    <article className="yj-panel mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
      <Link href="/login" className="text-accent-fg underline">YiJian</Link>
      <h1 className="text-2xl font-semibold">{supported ? c[kind].title : c.unavailable}</h1>
      <p className="break-all text-xs text-fg-muted">{SERVICE_POLICY_VERSION}</p>
      {supported && <>
        {c[kind].paragraphs.map((p, i) => <p key={i} className="text-sm leading-7">{p}</p>)}
        <section className="space-y-2 border-t border-border-default pt-5 text-sm">
          <h2 className="font-semibold">{c.operator}</h2>
          {policy?.configured ? <><p>{policy.operator}</p><p>{policy.address}</p><a className="break-all text-accent-fg underline" href={`mailto:${policy.contact}`}>{policy.contact}</a></> : <p role="status">{c.missingOperator}</p>}
        </section>
      </>}
      <ServicePolicyLinks locale={locale} />
      <Link href={`/privacy?lang=${locale}`} className="inline-block text-sm text-accent-fg underline">{c.privacy}</Link>
    </article>
  </main>;
}
