import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AppProviders } from '@/components/providers/AppProviders';
import { PublicProviders } from '@/components/providers/PublicProviders';
import './globals.css';
import { getRequestLocale } from '@/i18n/server';
import { createTextTranslator } from '@/i18n/text';
import { isLocale } from '@/i18n/locales';

export async function generateMetadata(): Promise<Metadata> {
  const t = createTextTranslator(await getRequestLocale());
  return {
  title: t('common.appName'),
  description: t('common.appDescription'),
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  };
}

// CSP nonce is generated per request in middleware, so HTML must be rendered
// dynamically instead of being reused from a static prerender.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? undefined;
  const demo = headersList.get('x-yijian-public-demo') === '1';
  const requestedLocale = headersList.get('x-yijian-demo-locale');
  const locale = demo && isLocale(requestedLocale) ? requestedLocale : await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {!demo && <script nonce={nonce} src="/runtime-config.js" suppressHydrationWarning></script>}
      </head>
      <body>
        {demo ? <PublicProviders locale={locale}>{children}</PublicProviders> : <AppProviders locale={locale}>{children}</AppProviders>}
      </body>
    </html>
  );
}
