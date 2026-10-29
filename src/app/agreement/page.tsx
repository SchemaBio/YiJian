import { getServerServicePolicy } from '@/lib/service-policy-server';
import { getRequestLocale } from '@/i18n/server';
import { policyLocale } from '@/i18n/locales';
import { UserAgreementDocument } from '@/components/shared/UserAgreementDocument';

export default async function AgreementPage({ searchParams }: { searchParams: Promise<{ lang?: string | string[]; version?: string | string[] }> }) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const lang = Array.isArray(params.lang) ? params.lang[0] : params.lang;
  const version = Array.isArray(params.version) ? params.version[0] : params.version;
  return <UserAgreementDocument locale={policyLocale(lang, locale)} version={version} initialPolicy={await getServerServicePolicy()} />;
}
