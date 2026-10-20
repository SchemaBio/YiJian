'use client';

import { useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { persistLocale, useLocaleSettings } from '@/components/providers/LocaleProvider';
import { locales, localeNames, type Locale } from '@/i18n/locales';
import { createTextTranslator } from '@/i18n/text';

export function LanguageSwitcher({ locale: overrideLocale, policy = false }: { locale?: Locale; policy?: boolean }) {
  const { locale: globalLocale, saveLocale } = useLocaleSettings();
  const locale = overrideLocale ?? globalLocale;
  const t = createTextTranslator(locale);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const shortNames: Record<Locale, string> = { 'zh-CN': '简体', 'zh-Hant': '繁體', en: 'EN', 'es-419': 'ES' };

  function chooseLocale(next: Locale) {
    try {
      setFailed(false);
      if (policy) {
        persistLocale(next);
        const url = new URL(window.location.href);
        url.searchParams.set('lang', next);
        window.location.assign(url.href);
      } else {
        saveLocale(next);
      }
      setOpen(false);
    } catch { setFailed(true); }
  }

  return <div className="absolute right-4 top-4 z-50 text-sm text-fg-muted sm:right-6 sm:top-6">
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={t('settings.interfaceLanguage')} title={localeNames[locale]}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition-colors hover:bg-canvas-subtle hover:text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-emphasis">
          <Languages aria-hidden="true" className="h-4 w-4" />
          <span>{shortNames[locale]}</span>
          <ChevronDown aria-hidden="true" className="h-3 w-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label={t('settings.interfaceLanguage')} align="end" sideOffset={6} collisionPadding={16}
          className="z-[100] w-52 rounded-2xl border border-border-default bg-canvas-default p-1.5 text-sm text-fg-default shadow-lg outline-none">
          {locales.map(value => <button key={value} type="button" lang={value} aria-pressed={locale === value}
            onClick={() => chooseLocale(value)}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-canvas-subtle focus-visible:bg-canvas-subtle focus-visible:outline-none">
            <span>{localeNames[value]}</span>
            {locale === value && <Check aria-hidden="true" className="h-4 w-4 text-success-fg" />}
          </button>)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
    {failed && <span role="alert" className="absolute right-0 mt-2 w-52 rounded-xl bg-canvas-default p-3 shadow-lg">{t('settings.languageSaveFailed')}</span>}
  </div>;
}
