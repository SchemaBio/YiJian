'use client';
import Link from 'next/link';
import { useText } from '@/i18n/useText';
import { SERVICE_POLICY_VERSION, type ServicePolicy } from '@/lib/service-policy';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';
import { UserAgreementDocument } from './UserAgreementDocument';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import type { Locale } from '@/i18n/locales';
import copy from '@/i18n/service-policy-v1.json';

export function ServicePolicyLinks({ locale }: { locale?: Locale } = {}) {
  const t = useText(); const selectedLocale = locale ?? t.locale; const c = copy[selectedLocale];
  if (getRuntimeBackendFlavor() !== 'squid') return null;
  return <nav aria-label={c.navigation} className="flex flex-wrap justify-center gap-4 text-sm text-accent-fg">
    {(['service', 'terms', 'refund'] as const).map(kind => <Link key={kind} href={`/agreement?lang=${selectedLocale}&version=${USER_AGREEMENT_VERSION}&purchase_version=${SERVICE_POLICY_VERSION}#${kind}`} className="underline">{c[kind].title}</Link>)}
  </nav>;
}

export function ServicePolicyDocument({ kind, locale, version, initialPolicy }: { initialPolicy?: ServicePolicy | null; kind: 'service' | 'terms' | 'refund'; locale: Locale; version?: string }) {
  return <UserAgreementDocument locale={locale} purchaseVersion={version} initialSection={kind} initialPolicy={initialPolicy} unavailableTitle={copy[locale].unavailable} />;
}