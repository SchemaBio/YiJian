import { useFormatter, useTimeZone } from 'next-intl';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { useText } from '@/i18n/useText';
import { LocaleProvider, persistLocale, useLocaleSettings } from './LocaleProvider';
import { localeCookie, locales } from '@/i18n/locales';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({useRouter: () => ({refresh})}));
function Probe() {
  const {locale, saveLocale} = useLocaleSettings();
  const [form, setForm] = useState('unsaved data');
  return <><output>{locale}</output><input aria-label="draft" value={form} onChange={e => setForm(e.target.value)} />
    <button onClick={() => saveLocale('es-419')}>save</button></>;
}
beforeEach(() => { document.cookie = `${localeCookie}=; Max-Age=0; Path=/`; refresh.mockClear(); });
describe('browser language preference', () => {
  it.each(locales)('hydrates the first %s render without a language mismatch', async locale => {
    function Heading() { const t = useText(); return <h1>{t('settings.interfaceLanguage')}</h1>; }
    const element = <LocaleProvider initialLocale={locale}><Heading /></LocaleProvider>;
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    const serverText = container.textContent;
    const errors = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, element, {onRecoverableError: errors}); });
    expect(container.textContent).toBe(serverText);
    expect(errors).not.toHaveBeenCalled();
    await act(async () => root!.unmount());
  });
  it.each(locales)('renders %s initially and preserves form state when saving', locale => {
    render(<LocaleProvider initialLocale={locale}><Probe /></LocaleProvider>);
    expect(screen.getByRole('status')).toHaveTextContent(locale);
    fireEvent.change(screen.getByLabelText('draft'), {target: {value: 'work in progress'}});
    fireEvent.click(screen.getByText('save'));
    expect(screen.getByRole('status')).toHaveTextContent('es-419');
    expect(screen.getByLabelText('draft')).toHaveValue('work in progress');
    expect(document.cookie).toContain(`${localeCookie}=es-419`);
    expect(document.documentElement.lang).toBe('es-419');
    expect(refresh).toHaveBeenCalledOnce();
  });
  it('fails if cookie persistence is blocked', () => {
    const cookie = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {});
    expect(() => persistLocale('en')).toThrow('could not be saved');
    cookie.mockRestore();
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Clock() {
  const format = useFormatter();
  const zone = useTimeZone();
  const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
  return <>
    <span data-testid="zone">{zone}</span>
    <span data-testid="winter">{format.dateTime(new Date('2026-01-15T12:00:00Z'), options)}</span>
    <span data-testid="summer">{format.dateTime(new Date('2026-07-15T12:00:00Z'), options)}</span>
  </>;
}

function browserTimeZone(initial: string) {
  let timeZone = initial;
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...resolved.call(this), timeZone };
  });
  return (next: string) => { timeZone = next; };
}

it.each([
  ['Asia/Shanghai', '20:00', '20:00'],
  ['America/Los_Angeles', '04:00', '05:00'],
  ['Europe/Berlin', '13:00', '14:00'],
])('uses the device time zone %s, including daylight saving, with Chinese UI', async (zone, winter, summer) => {
  browserTimeZone(zone);
  render(<LocaleProvider initialLocale="zh-CN"><Clock /></LocaleProvider>);
  await waitFor(() => expect(screen.getByTestId('zone')).toHaveTextContent(zone));
  expect(screen.getByTestId('winter')).toHaveTextContent(winter);
  expect(screen.getByTestId('summer')).toHaveTextContent(summer);
});

it('detects a device time zone change when returning to the page', async () => {
  const changeZone = browserTimeZone('Asia/Shanghai');
  render(<LocaleProvider initialLocale="en"><Clock /></LocaleProvider>);
  await waitFor(() => expect(screen.getByTestId('winter')).toHaveTextContent('20:00'));
  changeZone('America/Los_Angeles');
  fireEvent.focus(window);
  await waitFor(() => expect(screen.getByTestId('zone')).toHaveTextContent('America/Los_Angeles'));
  expect(screen.getByTestId('winter')).toHaveTextContent('04:00');
});
