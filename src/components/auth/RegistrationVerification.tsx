'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useText } from '@/i18n/useText';

// Legacy export also serves /verify-email, which now has no credential actions.
export function RegistrationVerification({ initialEmail = '', submitted = false }: { initialEmail?: string; submitted?: boolean }) {
  const t = useText();
  useEffect(() => {
    function clearLegacyToken() {
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    clearLegacyToken(); window.addEventListener('hashchange', clearLegacyToken);
    return () => window.removeEventListener('hashchange', clearLegacyToken);
  }, []);
  return <div className="yj-modern yj-public-shell flex items-center justify-center px-4 py-8 sm:p-8">
    <LanguageSwitcher />
    <div className="yj-panel yj-auth-card yj-auth-single space-y-5">
      <h1 className="text-2xl font-semibold">{t(submitted ? 'registration.manualTitle' : 'registration.legacyTitle')}</h1>
      <p role="status">{t(submitted ? 'registration.manualPending' : 'registration.legacyHint')}</p>
      {submitted && initialEmail && <p className="break-all text-sm text-fg-muted">{initialEmail}</p>}
      <Link className="text-accent-fg underline" href="/login">{t('registration.login')}</Link>
    </div>
  </div>;
}
