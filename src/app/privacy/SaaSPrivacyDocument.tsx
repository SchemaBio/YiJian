'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shield, ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { useAppLocale } from '@/components/providers/LocaleProvider';
import { getRuntimeSupportEmail } from '@/lib/runtime-config';
import { createTranslator } from 'next-intl';
import metadata from '@/i18n/privacy-saas-messages.json';
import policies from '@/i18n/privacy-saas.json';
import type { Locale } from '@/i18n/locales';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';

export function SaaSPrivacyDocument({ overrideLocale }: { overrideLocale?: Locale }) {
  const globalLocale = useAppLocale();
  const locale = overrideLocale ?? globalLocale;
  const t = useMemo(() => createTranslator({locale, messages: {privacy: metadata[locale]}}), [locale]);
  const { isAuthenticated, isLoading } = useAuth();
  const [contact, setContact] = useState('support@schema-bio.com');
  useEffect(() => { setContact(getRuntimeSupportEmail()); }, []);

  return <div className="yj-modern yj-public-shell relative" lang={locale}>
    <LanguageSwitcher locale={locale} policy />
    <div className="yj-legal-page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={isAuthenticated ? '/dashboard' : '/login'} aria-disabled={isLoading}
          onClick={event => { if (isLoading) event.preventDefault(); }}
          className={`inline-flex items-center gap-1.5 rounded-md border border-border-default px-3.5 py-2 text-sm text-fg-muted hover:text-fg-default ${isLoading ? 'cursor-wait opacity-60' : ''}`}>
          <ArrowLeft className="w-4 h-4" />{t('privacy.back')}
        </Link>
      </div>
      <header className="yj-panel mb-6 flex items-start gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-default bg-[var(--yj-sage-subtle)]">
          <Shield className="h-6 w-6 text-success-fg" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight text-fg-default">{t('privacy.title')}</h1>
          <p className="mt-2 text-sm text-fg-muted">SchemaBio · {t('privacy.platform')}</p>
          <p className="mt-3 text-xs text-fg-muted">{t('privacy.version')}</p>
        </div>
      </header>
      <div className="yj-public-alert mb-6 rounded-[var(--yj-radius-panel)] p-4 text-sm leading-relaxed">{t('privacy.notice')}</div>
      <div className="yj-panel yj-legal-card space-y-8">
        {policies[locale].map(section => {
          const retention = section.id === 'retention';
          return <section key={section.id} id={section.id} className={retention ? 'rounded-[var(--yj-radius-panel)] border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100' : undefined}>
            <h2 className={`mb-3 flex items-center gap-2 text-base font-semibold ${retention ? '' : 'text-fg-default'}`}>
              {retention && <Clock className="h-4 w-4 shrink-0" />}{section.title}
            </h2>
            <div className={`space-y-3 text-sm leading-relaxed pl-0 md:pl-6 ${retention ? '' : 'text-fg-muted'}`}>
              {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </section>;
        })}
        <section id="contact">
          <h2 className="mb-3 text-base font-semibold text-fg-default">{t('privacy.contactTitle')}</h2>
          <p className="text-sm leading-relaxed text-fg-muted pl-0 md:pl-6">{t('privacy.operator')}
            <a className="text-accent-fg underline break-all" href={`mailto:${contact}`}>{contact}</a>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted pl-0 md:pl-6">{t('privacy.contactInstructions')}</p>
        </section>
      </div>
      <footer className="mt-6 text-center text-xs text-fg-muted">SchemaBio · {t('privacy.footer')}</footer>
    </div>
  </div>;
}
