'use client';

import { ThemeProvider } from '@schema/ui-kit';
import { LocaleProvider } from './LocaleProvider';
import type { Locale } from '@/i18n/locales';

/** Public results never mount a session, upload manager or AI assistant. */
export function PublicProviders({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return <LocaleProvider initialLocale={locale}><ThemeProvider defaultTheme="light" storageKey="germline-theme">{children}</ThemeProvider></LocaleProvider>;
}
