'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';
import { getServicePolicy, type ServicePolicy } from '@/lib/service-policy';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import type { Locale } from '@/i18n/locales';
import agreements from '@/i18n/user-agreement-v1.json';

export function UserAgreementDocument({ locale, version, initialPolicy }: { locale: Locale; version?: string; initialPolicy?: ServicePolicy | null }) {
  const c = agreements[locale];
  const supported = !version || version === USER_AGREEMENT_VERSION;
  const [policy, setPolicy] = useState(initialPolicy ?? null);
  useEffect(() => {
    if (!supported || getRuntimeBackendFlavor() !== 'squid') return;
    let active = true;
    void getServicePolicy().then(value => { if (active) setPolicy(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [supported]);
  return <main className="yj-modern yj-public-shell relative min-h-screen px-4 py-14" lang={locale}>
    <LanguageSwitcher locale={locale} policy />
    <article className="yj-panel mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
      <Link href="/login" className="text-accent-fg underline">YiJian</Link>
      <h1 className="text-2xl font-semibold">{supported ? c.title : c.unavailable}</h1>
      <p className="break-all text-xs text-fg-muted">{supported ? USER_AGREEMENT_VERSION : version}</p>
      {supported && <>
        <p className="text-sm leading-7">{c.intro}</p>
        <p className="rounded-lg border border-border-default bg-canvas-subtle p-4 text-sm leading-7">{c.scope}</p>
        {c.sections.map((section, index) => <section key={index} className="space-y-3">
          <h2 className="text-base font-semibold">{index + 1}. {section.title}</h2>
          <p className="text-sm leading-7 text-fg-muted">{section.body}</p>
        </section>)}
        <section className="space-y-2 border-t border-border-default pt-5 text-sm">
          <h2 className="font-semibold">{c.operator}</h2>
          {policy?.configured ? <><p>{policy.operator}</p><p>{policy.address}</p><a className="break-all text-accent-fg underline" href={`mailto:${policy.contact}`}>{policy.contact}</a></> : <p>{c.missing}</p>}
        </section>
      </>}
      <nav aria-label={c.title} className="flex flex-wrap gap-4 text-sm text-accent-fg">
        {(['privacy', 'service', 'terms', 'refund'] as const).map(path => <Link key={path} href={`/${path}?lang=${locale}`} className="underline">{path === 'terms' ? c.purchase : c[path]}</Link>)}
      </nav>
    </article>
  </main>;
}
