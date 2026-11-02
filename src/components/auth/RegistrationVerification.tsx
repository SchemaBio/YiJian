'use client';

import * as React from 'react';
import Link from 'next/link';
import { ActionButton as Button } from '@/components/shared/ActionButton';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useText } from '@/i18n/useText';

export interface RegistrationPendingNoticeProps {
  initialEmail?: string;
  submitted?: boolean;
  onBackToLogin?: () => void;
  loginHref?: string;
  actionVariant?: 'link' | 'button';
  titleRef?: React.Ref<HTMLHeadingElement>;
}

export function RegistrationPendingNotice({
  initialEmail = '',
  submitted = false,
  onBackToLogin,
  loginHref = '/login',
  actionVariant = 'link',
  titleRef,
}: RegistrationPendingNoticeProps) {
  const t = useText();

  const internalTitleRef = React.useRef<HTMLHeadingElement>(null);
  const resolvedTitleRef = (titleRef as React.RefObject<HTMLHeadingElement>) || internalTitleRef;

  React.useEffect(() => {
    resolvedTitleRef.current?.focus();
  }, [resolvedTitleRef]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1
          ref={resolvedTitleRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-[var(--yj-text-strong)] outline-none focus:outline-none"
        >
          {t(submitted ? 'registration.manualTitle' : 'registration.legacyTitle')}
        </h1>
        <p role="status" className="text-sm leading-relaxed text-[var(--yj-text-muted)]">
          {t(submitted ? 'registration.manualPending' : 'registration.legacyHint')}
        </p>
      </div>

      {submitted && initialEmail && (
        <p className="break-all text-sm text-[var(--yj-text-muted)]">{initialEmail}</p>
      )}

      <div>
        {actionVariant === 'button' ? (
          <Button
            type="button"
            variant="primary"
            className="yj-public-primary w-full !h-12 !rounded-[var(--yj-radius-control)] !text-base font-medium"
            onClick={onBackToLogin}
          >
            {t('registration.login')}
          </Button>
        ) : (
          <Link
            className="text-accent-fg underline"
            href={loginHref}
            onClick={
              onBackToLogin
                ? (e) => {
                    e.preventDefault();
                    onBackToLogin();
                  }
                : undefined
            }
          >
            {t('registration.login')}
          </Link>
        )}
      </div>
    </div>
  );
}

export interface RegistrationVerificationProps {
  initialEmail?: string;
  submitted?: boolean;
  embedded?: boolean;
  actionVariant?: 'link' | 'button';
  onBackToLogin?: () => void;
  titleRef?: React.Ref<HTMLHeadingElement>;
  loginHref?: string;
}

// Legacy export also serves /verify-email, which now has no credential actions.
export function RegistrationVerification({
  initialEmail = '',
  submitted = false,
  embedded = false,
  actionVariant = embedded ? 'button' : 'link',
  onBackToLogin,
  titleRef,
  loginHref = '/login',
}: RegistrationVerificationProps) {
  React.useEffect(() => {
    function clearLegacyToken() {
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    clearLegacyToken();
    window.addEventListener('hashchange', clearLegacyToken);
    return () => window.removeEventListener('hashchange', clearLegacyToken);
  }, []);

  const content = (
    <RegistrationPendingNotice
      initialEmail={initialEmail}
      submitted={submitted}
      actionVariant={actionVariant}
      onBackToLogin={onBackToLogin}
      titleRef={titleRef}
      loginHref={loginHref}
    />
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="yj-modern yj-public-shell flex items-center justify-center px-4 py-8 sm:p-8">
      <LanguageSwitcher />
      <div className="yj-panel yj-auth-card yj-auth-single space-y-5">
        {content}
      </div>
    </div>
  );
}
