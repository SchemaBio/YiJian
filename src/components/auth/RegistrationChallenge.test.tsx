import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RegistrationChallenge } from './RegistrationChallenge';
import { createTextTranslator } from '@/i18n/text';

vi.mock('@/i18n/useText', () => ({ useText: () => createTextTranslator('en') }));
afterEach(() => { delete window.turnstile; });
describe('registration challenge lifecycle', () => {
  it('clears expired tokens and lets the user obtain a fresh widget', async () => {
    let options: Record<string, unknown> = {};
    const renderWidget = vi.fn((_element: HTMLElement, next: Record<string, unknown>) => { options = next; return 'test-widget'; });
    const remove = vi.fn(); window.turnstile = { render: renderWidget, remove };
    const token = vi.fn();
    render(<RegistrationChallenge siteKey="test-key" action="registration" generation={0} onToken={token} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
    expect(options).toMatchObject({ sitekey: 'test-key', action: 'registration', language: 'en' });
    act(() => (options.callback as (value: string) => void)('valid-token'));
    expect(token).toHaveBeenLastCalledWith('valid-token');
    act(() => (options['expired-callback'] as () => void)());
    expect(token).toHaveBeenLastCalledWith('');
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(remove).toHaveBeenCalledWith('test-widget');
  });
  it('does not retain a token when the provider reports an error', async () => {
    let options: Record<string, unknown> = {};
    window.turnstile = { render: (_element, next) => { options = next; return 'test-widget'; }, remove: vi.fn() };
    const token = vi.fn();
    render(<RegistrationChallenge siteKey="test-key" action="registration-resend" generation={0} onToken={token} />);
    await waitFor(() => expect(options.action).toBe('registration-resend'));
    act(() => (options['error-callback'] as () => void)());
    expect(token).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('alert')).toHaveTextContent('Verification failed');
  });
});
