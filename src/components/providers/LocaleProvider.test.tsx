import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
