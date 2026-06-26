import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { AppProviders } from '@/components/providers/AppProviders';
import './globals.css';

export const metadata: Metadata = {
  title: '贻鉴',
  description: '专业的全外显子遗传病基因组分析系统',
  keywords: ['基因组分析', '遗传病', 'ACMG', '变异分析', '全外显子'],
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

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

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <Script nonce={nonce} src="/runtime-config.js" strategy="beforeInteractive" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
