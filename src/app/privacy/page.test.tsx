import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrivacyPage from './page';
import { PrivacyDocument } from './PrivacyDocument';
import { locales, localeNames, type Locale } from '@/i18n/locales';
import policies from '@/i18n/privacy.json';

const state = vi.hoisted(() => ({ locale: 'zh-CN' as Locale, backend: 'octopus' }));
vi.mock('@/i18n/server', () => ({ getRequestLocale: async () => state.locale }));
vi.mock('@/components/providers/LocaleProvider', () => ({ useAppLocale: () => state.locale, useLocaleSettings: () => ({ locale: state.locale, saveLocale: vi.fn() }) }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: false, isLoading: false }) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeSupportEmail: () => 'privacy@example.com', getRuntimeBackendFlavor: () => state.backend }));

const titles: Record<Locale,string> = {'zh-CN':'隐私政策','zh-Hant':'隱私政策',en:'Privacy Policy','es-419':'Política de privacidad'};
describe('four-language privacy policy', () => {
  beforeEach(() => { state.backend = 'octopus'; });
  it.each(locales)('follows the global %s locale with a language switch', locale => {
    state.locale = locale;
    render(<PrivacyDocument />);
    expect(screen.getByRole('heading', {name: titles[locale], level: 1})).toBeInTheDocument();
    const notice = screen.getByRole('heading', {name: policies[locale][4].title}).closest('section');
    expect(notice).toHaveClass('border-amber-300', 'bg-amber-50', 'dark:bg-amber-950/30');
    expect(screen.getByRole('button')).toHaveAttribute('title', localeNames[locale]);
    expect(document.querySelector('a[href^="mailto:"]')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/SchemaBio|schema-bio|SaaS|720/);
    expect(screen.getByText(/2026-10-16/)).toBeInTheDocument();
  });
  it.each(['zh','en', ...locales])('resolves the %s policy deep link on the server without changing preference', async lang => {
    state.locale = 'es-419';
    const cookieBefore = document.cookie;
    render(await PrivacyPage({searchParams: Promise.resolve({lang})}));
    const locale = lang === 'zh' ? 'zh-CN' : lang as Locale;
    expect(screen.getByRole('heading', {name: titles[locale],level:1})).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('title', localeNames[locale]);
    expect(document.cookie).toBe(cookieBefore);
    expect(state.locale).toBe('es-419');
  });
  it('falls back to the global locale for an invalid query', async () => {
    state.locale = 'en';
    render(await PrivacyPage({searchParams: Promise.resolve({lang:'invalid'})}));
    expect(screen.getByRole('heading', {name:'Privacy Policy',level:1})).toBeInTheDocument();
    expect(screen.getByText(/does not impose a hosted service/)).toBeInTheDocument();
    expect(screen.getByText(/deployer provides the service/)).toBeInTheDocument();
  });
  it('keeps section and paragraph counts consistent', () => {
    for (const locale of locales) {
      expect(policies[locale].map(s => [s.id,s.paragraphs.length])).toEqual(policies['zh-CN'].map(s => [s.id,s.paragraphs.length]));
    }
  });
});

describe('SaaS policy isolation', () => {
 it.each(locales)('retains the hosted policy and operator contact in %s', locale => {
  state.backend='squid';state.locale=locale;
  render(<PrivacyDocument />);
  expect(screen.getByRole('link', {name:'privacy@example.com'})).toHaveAttribute('href','mailto:privacy@example.com');
  expect(document.body).toHaveTextContent('SchemaBio');
  expect(document.body).toHaveTextContent(/720/);
  expect(document.body).not.toHaveTextContent(/deployer provides the service|部署者自行提供服务/);
 });
});
