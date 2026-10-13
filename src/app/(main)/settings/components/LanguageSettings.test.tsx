import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider, useLocaleSettings } from '@/components/providers/LocaleProvider';
import { LanguageSettings } from './LanguageSettings';

vi.mock('next/navigation', () => ({useRouter: () => ({refresh: vi.fn()})}));
function CurrentLanguage() { return <span data-testid="locale">{useLocaleSettings().locale}</span>; }
beforeEach(() => { document.cookie = 'yijian-locale=; Max-Age=0; Path=/'; });
describe('language settings', () => {
  it('requires Save before applying the selected language', () => {
    render(<LocaleProvider initialLocale="zh-CN"><LanguageSettings /><CurrentLanguage /></LocaleProvider>);
    expect(screen.getAllByRole('option')).toHaveLength(4);
    fireEvent.change(screen.getByRole('combobox'), {target: {value: 'es-419'}});
    expect(screen.getByTestId('locale')).toHaveTextContent('zh-CN');
    expect(document.cookie).not.toContain('es-419');
    fireEvent.click(screen.getByRole('button', {name: '保存语言设置'}));
    expect(screen.getByTestId('locale')).toHaveTextContent('es-419');
    expect(screen.getByRole('status')).toHaveTextContent('Configuración de idioma guardada');
  });
  it('reports a blocked cookie without changing the active language', () => {
    render(<LocaleProvider initialLocale="zh-CN"><LanguageSettings /><CurrentLanguage /></LocaleProvider>);
    fireEvent.change(screen.getByRole('combobox'), {target: {value: 'en'}});
    const cookie = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', {name: '保存语言设置'}));
    expect(screen.getByRole('alert')).toHaveTextContent('无法保存语言设置');
    expect(screen.getByTestId('locale')).toHaveTextContent('zh-CN');
    cookie.mockRestore();
  });
});
