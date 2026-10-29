'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '@/components/providers/AuthProvider';
import { getServicePolicy, SERVICE_POLICY_VERSION, type ServicePolicy } from '@/lib/service-policy';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import type { Locale } from '@/i18n/locales';
import agreements from '@/i18n/user-agreement-v1.json';
import serviceCopy from '@/i18n/service-policy-v1.json';
import privacyMeta from '@/i18n/privacy-saas-messages.json';
import uiCopy from '@/i18n/agreement-ui.json';

type PolicySection = 'service' | 'terms' | 'refund';
export function UserAgreementDocument({ locale, version, purchaseVersion, initialSection, initialPolicy, unavailableTitle }: {
  locale: Locale; version?: string; purchaseVersion?: string; initialSection?: PolicySection;
  initialPolicy?: ServicePolicy | null; unavailableTitle?: string;
}) {
  const c = agreements[locale];
  const service = serviceCopy[locale];
  const ui = uiCopy[locale];
  const { isAuthenticated, isLoading } = useAuth();
  const supported = (!version || version === USER_AGREEMENT_VERSION) && (!purchaseVersion || purchaseVersion === SERVICE_POLICY_VERSION);
  const [policy, setPolicy] = useState(initialPolicy ?? null);
  useEffect(() => {
    if (!supported || getRuntimeBackendFlavor() !== 'squid') return;
    let active = true;
    void getServicePolicy().then(value => { if (active) setPolicy(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [supported]);
  useEffect(() => {
    const section = initialSection ?? window.location.hash.slice(1);
    if (supported && ['usage-terms','service','terms','refund','contact'].includes(section)) document.getElementById(section)?.scrollIntoView?.({ block: 'start' });
  }, [supported, initialSection]);
  const kinds = ['service', 'terms', 'refund'] as const;
  return <main className="yj-modern yj-public-shell relative" lang={locale}>
    <LanguageSwitcher locale={locale} policy />
    <div className="yj-legal-page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={isAuthenticated ? '/dashboard' : '/login'} aria-disabled={isLoading}
          onClick={event => { if (isLoading) event.preventDefault(); }}
          className={`inline-flex items-center gap-1.5 rounded-md border border-border-default px-3.5 py-2 text-sm text-fg-muted hover:text-fg-default ${isLoading ? 'cursor-wait opacity-60' : ''}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true"/>{privacyMeta[locale].back}
        </Link>
      </div>
      <header className="yj-panel mb-6 flex items-start gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-default bg-[var(--yj-sage-subtle)]"><FileText className="h-6 w-6 text-success-fg" aria-hidden="true"/></div>
        <div className="min-w-0"><h1 className="text-2xl font-semibold leading-tight text-fg-default">{supported ? c.title : unavailableTitle ?? c.unavailable}</h1><p className="mt-2 text-sm text-fg-muted">{ui.platform}</p><p className="mt-3 text-xs text-fg-muted">{ui.updated}</p></div>
      </header>
      {supported ? <>
        <div className="yj-public-alert mb-6 rounded-[var(--yj-radius-panel)] p-4 text-sm leading-relaxed"><p>{c.intro}</p><p className="mt-2">{c.scope}</p></div>
        <nav aria-label={ui.contents} className="yj-panel mb-6 flex flex-wrap gap-2 p-3 text-sm text-fg-muted">
          {[{id:'usage-terms',title:ui.usage},...kinds.map(kind=>({id:kind,title:service[kind].title})),{id:'contact',title:c.operator}].map(link=><a key={link.id} href={`#${link.id}`} className="rounded-md border border-border-default px-3 py-2 hover:bg-canvas-subtle hover:text-fg-default">{link.title}</a>)}
        </nav>
        <article className="yj-panel yj-legal-card space-y-8">
          {c.sections.map((section, index) => <section key={index} id={index===0?'usage-terms':`usage-${index+1}`} className="scroll-mt-6">
            <h2 className="mb-3 text-base font-semibold text-fg-default">{index + 1}. {section.title}</h2>
            <div className="space-y-3 pl-0 text-sm leading-relaxed text-fg-muted md:pl-6"><p>{section.body}</p></div>
          </section>)}
          {kinds.map((kind,index)=><section key={kind} id={kind} className="scroll-mt-6">
            <h2 className="mb-3 text-base font-semibold text-fg-default">{c.sections.length+index+1}. {service[kind].title}</h2>
            <div className="space-y-3 pl-0 text-sm leading-relaxed text-fg-muted md:pl-6">{service[kind].paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>
          </section>)}
          <section id="contact" className="scroll-mt-6">
            <h2 className="mb-3 text-base font-semibold text-fg-default">{c.operator}</h2>
            <div className="space-y-3 pl-0 text-sm leading-relaxed text-fg-muted md:pl-6">{policy?.configured ? <><p>{policy.operator}</p><p>{policy.address}</p><a className="break-all text-accent-fg underline" href={`mailto:${policy.contact}`}>{policy.contact}</a></> : <p role="status">{c.missing}</p>}</div>
          </section>
        </article>
      </> : <div className="yj-panel yj-legal-card"><p className="break-all text-sm text-fg-muted">{version && version!==USER_AGREEMENT_VERSION ? version : purchaseVersion}</p></div>}
      <footer className="mt-6 space-y-3 text-center text-xs text-fg-muted">{supported&&<p className="break-all">{USER_AGREEMENT_VERSION} · {SERVICE_POLICY_VERSION}</p>}<Link href={`/privacy?lang=${locale}`} className="inline-block text-sm text-accent-fg underline">{c.privacy}</Link></footer>
    </div>
  </main>;
}
