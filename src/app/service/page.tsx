import { getServerServicePolicy } from '@/lib/service-policy-server';
import { getRequestLocale } from '@/i18n/server';
import { policyLocale } from '@/i18n/locales';
import { ServicePolicyDocument } from '@/components/shared/ServicePolicyDocument';
export default async function Page({ searchParams }: { searchParams: Promise<{lang?: string; version?: string}> }) {
 const params = await searchParams; const locale = await getRequestLocale();
 return <ServicePolicyDocument kind="service" locale={policyLocale(params.lang, locale)} version={params.version} initialPolicy={await getServerServicePolicy()} />;
}
