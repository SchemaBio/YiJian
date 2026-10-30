import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import type { Locale } from '@/i18n/locales';
const state=vi.hoisted(()=>({locale:'en' as string,post:vi.fn()}));
vi.mock('@/i18n/useText',()=>({useText:()=>createTextTranslator(state.locale as Locale)}));
vi.mock('@/lib/api',()=>({api:{post:state.post}}));
vi.mock('@/components/shared/LanguageSwitcher',()=>({LanguageSwitcher:()=>null}));
import { RegistrationVerification } from './RegistrationVerification';
afterEach(()=>{cleanup();vi.clearAllMocks();window.history.replaceState(null,'','/');});
it.each(['zh-CN','zh-Hant','en','es-419'] as const)('shows manual review after signup in %s without sending email',locale=>{
 state.locale=locale;const t=createTextTranslator(locale);
 render(<RegistrationVerification initialEmail="user@example.org" submitted/>);
 expect(screen.getByRole('heading')).toHaveTextContent(t('registration.manualTitle'));
 expect(screen.getByRole('status')).toHaveTextContent(t('registration.manualPending'));
 expect(screen.getByRole('link')).toHaveAttribute('href','/login');
 expect(screen.queryByRole('textbox')).not.toBeInTheDocument();expect(screen.queryByRole('button')).not.toBeInTheDocument();
 expect(state.post).not.toHaveBeenCalled();
});
it('retires old verification links and clears tokens without submitting credentials',()=>{
 state.locale='en';window.history.replaceState(null,'','/verify-email#token=private-token');
 render(<RegistrationVerification/>);
 expect(window.location.hash).toBe('');expect(screen.getByRole('heading')).toHaveTextContent('Registration process updated');
 expect(screen.queryByRole('textbox')).not.toBeInTheDocument();expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(state.post).not.toHaveBeenCalled();
});
