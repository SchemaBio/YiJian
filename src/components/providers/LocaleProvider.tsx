'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { UiKitLocaleProvider } from '@schema/ui-kit';
import { useRouter } from 'next/navigation';
import { getMessages } from '@/i18n/messages';
import { isLocale, localeCookie, type Locale } from '@/i18n/locales';
import { createTextTranslator, type TextValues } from '@/i18n/text';

const LocaleContext = createContext<{ locale: Locale; saveLocale: (locale: Locale) => void } | null>(null);

export function persistLocale(locale: Locale): void {
  if (!isLocale(locale)) throw new Error('Invalid locale');
  document.cookie = `${localeCookie}=${locale}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  const saved = document.cookie.split(';').some(part => part.trim() === `${localeCookie}=${locale}`);
  if (!saved) throw new Error('Locale cookie could not be saved');
}

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocale] = useState(initialLocale);
  const router = useRouter();
  const kitText = useMemo(() => {
    const t = createTextTranslator(locale);
    return (key: string, values?: TextValues) => t(`uiKit.${key}`, values);
  }, [locale]);
  useEffect(() => { setLocale(initialLocale); }, [initialLocale]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  function saveLocale(next: Locale) {
    persistLocale(next);
    setLocale(next);
    document.documentElement.lang = next;
    router.refresh();
  }
  return <LocaleContext.Provider value={{ locale, saveLocale }}>
    <NextIntlClientProvider locale={locale} messages={getMessages(locale)} timeZone="Asia/Shanghai">
      <UiKitLocaleProvider translate={kitText}>{children}</UiKitLocaleProvider>
    </NextIntlClientProvider>
  </LocaleContext.Provider>;
}

export function useLocaleSettings() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('Language settings require LocaleProvider');
  return value;
}

export function useAppLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? 'zh-CN';
}
