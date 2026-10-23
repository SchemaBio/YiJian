'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ActionButton } from '@/components/shared/ActionButton';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { RegistrationChallenge, useRegistrationAvailability } from './RegistrationChallenge';
import { api, ApiError } from '@/lib/api';
import { hashPassword } from '@/lib/crypto';
import { useText } from '@/i18n/useText';

export function RegistrationVerification({ initialEmail = '', submitted = false }: { initialEmail?: string; submitted?: boolean }) {
  const t = useText();
  const config = useRegistrationAvailability();
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState('');
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    function consumeLink() {
      const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (!value) return;
      setToken(value); setVerified(false); setPassword(''); setError(''); setMessage('');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    consumeLink();
    window.addEventListener('hashchange', consumeLink);
    return () => window.removeEventListener('hashchange', consumeLink);
  }, []);

  async function confirm() {
    setBusy(true); setError('');
    try {
      const canonicalEmail = email.trim().toLowerCase();
      const newPassword = await hashPassword(password, canonicalEmail);
      await api.post('/v1/auth/registration/verify', { token, email: canonicalEmail, new_password: newPassword }, { coreApi: false });
      setVerified(true); setToken(''); setPassword('');
    } catch (error) { setError(t(error instanceof ApiError && (error.data as { error?: string })?.error === 'invalid registration password' ? 'registration.passwordInvalid' : 'registration.linkInvalid')); }
    finally { setBusy(false); }
  }
  async function resend(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/v1/auth/registration/resend', { email: email.trim().toLowerCase(), turnstile_token: challenge }, { coreApi: false });
      setMessage(t('registration.sent'));
    } catch { setError(t('registration.retryLater')); }
    finally { setBusy(false); setChallenge(''); setGeneration(value => value + 1); }
  }

  return <div className="yj-modern yj-public-shell flex items-center justify-center px-4 py-8 sm:p-8">
    <LanguageSwitcher />
    <div className="yj-panel yj-auth-card yj-auth-single space-y-5">
      <h1 className="text-2xl font-semibold">{t(verified ? 'registration.verified' : 'registration.verifyTitle')}</h1>
      <p>{t(verified ? 'registration.pending' : submitted ? 'registration.sent' : 'registration.confirmHint')}</p>
      {error ? <p role="alert" className="yj-public-alert rounded-xl p-3">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {error && token ? <button type="button" className="text-accent-fg underline" onClick={() => setToken('')}>{t('registration.resend')}</button> : null}
      {token && !verified ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void confirm(); }}>
        <label className="block">{t('registration.email')}<input className="block w-full rounded-xl border p-3" type="email" required maxLength={100} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label className="block">{t('registration.ownerPassword')}<input className="block w-full rounded-xl border p-3" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <p className="text-sm text-fg-muted">{t('registration.ownerPasswordHint')}</p>
        <ActionButton type="submit" disabled={busy || !email.trim() || password.length < 8}>{t('registration.confirm')}</ActionButton>
      </form> : null}
      {!verified && !token ? <form className="space-y-4" onSubmit={resend}>
        <label className="block">{t('registration.email')}<input className="block w-full rounded-xl border p-3" type="email" required maxLength={100} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        {config?.enabled ? <RegistrationChallenge siteKey={config.site_key} action="registration-resend" generation={generation} onToken={setChallenge} /> : <p role="status">{t(config ? 'registration.unavailable' : 'registration.loading')}</p>}
        <ActionButton type="submit" disabled={busy || !config?.enabled || !challenge}>{t('registration.resend')}</ActionButton>
      </form> : null}
      <Link className="text-accent-fg underline" href="/login">{t('registration.login')}</Link>
    </div>
  </div>;
}
