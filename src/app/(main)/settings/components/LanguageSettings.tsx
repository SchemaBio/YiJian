'use client';

import { useEffect, useState } from 'react';
import { useLocaleSettings } from '@/components/providers/LocaleProvider';
import { ActionButton } from '@/components/shared/ActionButton';
import { locales, localeNames, type Locale } from '@/i18n/locales';
import { useText } from '@/i18n/useText';

export function LanguageSettings() {
  const {locale, saveLocale} = useLocaleSettings();
  const t = useText();
  const [draft, setDraft] = useState<Locale>(locale);
  const [status, setStatus] = useState<'saved' | 'failed' | null>(null);
  useEffect(() => { setDraft(locale); }, [locale]);
  return <section className="yj-panel p-5 lg:col-span-2">
    <h3 className="mb-2 text-base font-medium text-fg-default">{t('settings.interfaceLanguage')}</h3>
    <p className="mb-4 text-sm text-fg-muted">{t('settings.languageDescription')}</p>
    <div className="flex flex-wrap items-center gap-3">
      <select aria-label={t('settings.interfaceLanguage')} value={draft}
        className="h-10 max-w-full rounded-md border border-border-default bg-canvas-default px-3 text-sm text-fg-default"
        onChange={event => { setDraft(event.target.value as Locale); setStatus(null); }}>
        {locales.map(value => <option key={value} value={value}>{localeNames[value]}</option>)}
      </select>
      <ActionButton action="save" disabled={draft === locale} onClick={() => {
        try { saveLocale(draft); setStatus('saved'); } catch { setStatus('failed'); }
      }}>{t('settings.saveLanguage')}</ActionButton>
      {status && <span role={status === 'failed' ? 'alert' : 'status'} className="text-sm">
        {t(status === 'failed' ? 'settings.languageSaveFailed' : 'settings.languageSaved')}
      </span>}
    </div>
  </section>;
}
