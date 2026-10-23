import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegistrationVerification } from './RegistrationVerification';
import { createTextTranslator } from '@/i18n/text';
import type { Locale } from '@/i18n/locales';

const state = vi.hoisted(() => ({ locale: 'en' as Locale, enabled: true, post: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ hashPassword: async (value: string) => value }));
vi.mock('@/lib/api', () => ({ api: { post: state.post }, ApiError: class extends Error {} }));
vi.mock('@/components/shared/LanguageSwitcher', () => ({ LanguageSwitcher: () => <button>Language</button> }));
vi.mock('@/components/shared/ActionButton', () => ({ ActionButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} /> }));
vi.mock('@/i18n/useText', () => ({ useText: () => createTextTranslator(state.locale) }));
vi.mock('./RegistrationChallenge', () => ({
  useRegistrationAvailability: () => ({ enabled: state.enabled, site_key: 'test' }),
  RegistrationChallenge: ({ onToken }: { onToken: (value: string) => void }) => <button type="button" onClick={() => onToken('test-challenge')}>Solve challenge</button>,
}));

describe('registration email confirmation', () => {
  beforeEach(() => { state.locale = 'en'; state.enabled = true; state.post.mockReset().mockResolvedValue({}); window.history.replaceState(null, '', '/verify-email'); });
  it.each(['zh-CN', 'zh-Hant', 'en', 'es-419'] as Locale[])('requires explicit confirmation in %s and removes the token from the address', async locale => {
    state.locale = locale;
    const t = createTextTranslator(locale);
    window.history.replaceState(null, '', '/verify-email#token=private-test-token');
    render(<RegistrationVerification />);
    const button = await screen.findByRole('button', { name: t('registration.confirm') });
    expect(window.location.hash).toBe('');
    expect(state.post).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t('registration.email')), { target: { value: 'owner@example.org' } });
    fireEvent.change(screen.getByLabelText(t('registration.ownerPassword')), { target: { value: 'Owner-Password-42' } });
    fireEvent.click(button);
    await screen.findByRole('heading', { name: t('registration.verified') });
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(state.post).toHaveBeenCalledWith('/v1/auth/registration/verify', { token: 'private-test-token', email: 'owner@example.org', new_password: 'Owner-Password-42' }, { coreApi: false });
    expect(screen.getByText(t('registration.pending'))).toBeInTheDocument();
  });
  it('keeps verification usable while new signup is paused', async () => {
    state.enabled = false;
    window.history.replaceState(null, '', '/verify-email#token=private-test-token');
    render(<RegistrationVerification />);
    await screen.findByRole('button', { name: 'Confirm registration email' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.org' } });
    fireEvent.change(screen.getByLabelText('Set sign-in password'), { target: { value: 'Owner-Password-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm registration email' }));
    await screen.findByRole('heading', { name: 'Email verified' });
  });
  it('resends only with a fresh challenge and normalizes email', async () => {
    render(<RegistrationVerification initialEmail="TEST@Example.org" submitted />);
    const resend = screen.getByRole('button', { name: 'Resend verification email' });
    expect(resend).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Solve challenge' }));
    fireEvent.click(resend);
    await waitFor(() => expect(state.post).toHaveBeenCalledWith('/v1/auth/registration/resend', { email: 'test@example.org', turnstile_token: 'test-challenge' }, { coreApi: false }));
    await waitFor(() => expect(resend).toBeDisabled());
  });
  it('shows an expired-link error without claiming email verification', async () => {
    state.post.mockRejectedValue(new Error('expired'));
    window.history.replaceState(null, '', '/verify-email#token=expired');
    render(<RegistrationVerification />);
    await screen.findByRole('button', { name: 'Confirm registration email' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.org' } });
    fireEvent.change(screen.getByLabelText('Set sign-in password'), { target: { value: 'Owner-Password-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm registration email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('expired');
    expect(screen.queryByRole('heading', { name: 'Email verified' })).not.toBeInTheDocument();
  });
  it('accepts a new email link in an already open verification tab', async () => {
    render(<RegistrationVerification />);
    expect(screen.queryByRole('button', { name: 'Confirm registration email' })).not.toBeInTheDocument();
    window.history.replaceState(null, '', '/verify-email#token=new-link-token');
    fireEvent(window, new Event('hashchange'));
    expect(await screen.findByRole('button', { name: 'Confirm registration email' })).toBeDisabled();
    expect(window.location.hash).toBe('');
    expect(state.post).not.toHaveBeenCalled();
  });
});
