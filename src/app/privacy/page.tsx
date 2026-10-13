import { getRequestLocale } from '@/i18n/server';
import { policyLocale } from '@/i18n/locales';
import { PrivacyDocument } from './PrivacyDocument';

export default async function PrivacyPage({ searchParams }: {
  searchParams: Promise<{lang?: string | string[]}>;
}) {
  const params = await searchParams;
  const preference = Array.isArray(params.lang) ? params.lang[0] : params.lang;
  const locale = await getRequestLocale();
  return <PrivacyDocument overrideLocale={preference ? policyLocale(preference, locale) : undefined} />;
}
