'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@schema/ui-kit';
import { UserPlus } from 'lucide-react';
import { ActionButton as Button } from '@/components/shared/ActionButton';
import { api, ApiError, clearLegacyAuthTokens } from '@/lib/api';
import { hashPassword } from '@/lib/crypto';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';
import { RegistrationChallenge, useRegistrationAvailability } from '@/components/auth/RegistrationChallenge';
import { useText } from '@/i18n/useText';
import { errorText } from '@/i18n/errors';

export interface RegisterFormProps {
  email: string;
  onEmailChange: (value: string) => void;
  onSwitchToLogin?: () => void;
  loginHref?: string;
  isSwitchDisabled?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onRegistrationSubmitted?: (email: string) => void;
  titleRef?: React.Ref<HTMLHeadingElement>;
  nextPath?: string;
  autoFocusTitle?: boolean;
}

export function RegisterForm({
  email,
  onEmailChange,
  onSwitchToLogin,
  loginHref = '/login',
  isSwitchDisabled = false,
  onLoadingChange,
  onRegistrationSubmitted,
  titleRef,
  nextPath = '/dashboard',
  autoFocusTitle = true,
}: RegisterFormProps) {
  const t = useText();
  const router = useRouter();

  const internalTitleRef = React.useRef<HTMLHeadingElement>(null);
  const resolvedTitleRef = (titleRef as React.RefObject<HTMLHeadingElement>) || internalTitleRef;

  React.useEffect(() => {
    if (autoFocusTitle) {
      resolvedTitleRef.current?.focus();
    }
  }, [autoFocusTitle, resolvedTitleRef]);

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [confirmationTouched, setConfirmationTouched] = React.useState(false);
  const [agreePolicies, setAgreePolicies] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [challenge, setChallenge] = React.useState('');
  const [generation, setGeneration] = React.useState(0);

  const backendFlavor = getRuntimeBackendFlavor();
  const isSaaS = backendFlavor === 'squid';
  const registrationConfig = useRegistrationAvailability(isSaaS);

  const confirmationError = confirmationTouched
    ? !confirmPassword
      ? t('auth.completeAllRequiredFields61d4e1')
      : password !== confirmPassword
      ? t('auth.registrationPasswordsMismatch')
      : ''
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmationTouched(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;
    const cleanName = name.trim();

    if (!cleanEmail || !cleanPassword || !confirmPassword) {
      setError(t("auth.completeAllRequiredFields61d4e1"));
      return;
    }

    if (cleanPassword.length < 8) {
      setError(t("auth.passwordMustHaveAtLeastCharactersb6a69b"));
      return;
    }

    if (cleanPassword !== confirmPassword) {
      setError(t('auth.registrationPasswordsMismatch'));
      return;
    }

    if (!agreePolicies) {
      setError(t('auth.acknowledgePrivacyAndAgreeToTerms'));
      return;
    }

    if (isSaaS && (!registrationConfig?.enabled || registrationConfig.review_mode !== 'manual' || !challenge)) {
      setError(t('registration.unavailable'));
      return;
    }

    setLoading(true);
    onLoadingChange?.(true);

    try {
      const hashedPassword = await hashPassword(cleanPassword, cleanEmail);
      const response = await api.post<{ access_token?: string; message?: string }>(
        '/v1/auth/register',
        {
          email: cleanEmail,
          password: hashedPassword,
          ...(cleanName ? { name: cleanName } : {}),
          ...(isSaaS ? { turnstile_token: challenge, locale: t.locale } : {}),
        },
        { coreApi: false }
      );

      clearLegacyAuthTokens();
      if (!response?.access_token && response?.message) {
        if (isSaaS) {
          onRegistrationSubmitted?.(cleanEmail);
          return;
        }
        router.push('/login?registered=pending');
        return;
      }
      router.push(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = (err.data as any)?.error || (err.data as any)?.message || t("auth.registrationFaileda1d7fb");
        setError(errorText(String(msg), t));
      } else {
        setError(t("auth.networkErrorRetryLatereb9dcb"));
      }
      setChallenge('');
      setGeneration((v) => v + 1);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1
          ref={resolvedTitleRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-[var(--yj-text-strong)] outline-none focus:outline-none"
        >
          {t("auth.createAccount4742b5")}
        </h1>
        <p className="mt-2 text-sm text-[var(--yj-text-muted)]">
          {isSaaS
            ? t("auth.createATeamAccountAdministratorApprovalIsf98187")
            : t("auth.createAnAccountToStartUsingYijian2be3bc")}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-[var(--yj-text-muted)]">
          {t(isSaaS ? 'research.audience' : 'research.selfHostedScope')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="register-form space-y-5">
        {error && (
          <div role="alert" className="yj-public-alert rounded-xl p-3.5 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="register-email" className="block text-sm font-medium text-[var(--yj-text-strong)]">
            {t("settings.email9ed627")} <span aria-hidden="true" className="text-danger-fg">*</span>
          </label>
          <Input
            id="register-email"
            aria-label={t("settings.email9ed627")}
            type="email"
            required
            maxLength={100}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t("auth.emailf1f231")}
            autoComplete="email"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-name" className="block text-sm font-medium text-[var(--yj-text-strong)]">
            {t('auth.registrationNameOptional')}
          </label>
          <Input
            id="register-name"
            aria-label={t('auth.registrationNameOptional')}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.registrationNameOptional')}
            autoComplete="name"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-password" className="block text-sm font-medium text-[var(--yj-text-strong)]">
            {t("auth.passwordAtLeastCharacters692b63")} <span aria-hidden="true" className="text-danger-fg">*</span>
          </label>
          <Input
            id="register-password"
            aria-label={t("auth.passwordAtLeastCharacters692b63")}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.passwordAtLeastCharacters8adf42")}
            autoComplete="new-password"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-confirm-password" className="block text-sm font-medium text-[var(--yj-text-strong)]">
            {t('auth.registrationConfirmPassword')} <span aria-hidden="true" className="text-danger-fg">*</span>
          </label>
          <Input
            id="register-confirm-password"
            aria-label={t('auth.registrationConfirmPassword')}
            type="password"
            required
            aria-required="true"
            aria-invalid={confirmationTouched ? (confirmationError ? 'true' : 'false') : false}
            aria-describedby={confirmationTouched && confirmationError ? "register-confirm-password-error" : undefined}
            onBlur={() => setConfirmationTouched(true)}
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('auth.registrationConfirmPassword')}
            autoComplete="new-password"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
          {confirmationTouched && confirmationError && (
            <p id="register-confirm-password-error" className="text-sm text-danger-fg" aria-live="polite">
              {confirmationError}
            </p>
          )}
        </div>

        {isSaaS && (
          registrationConfig?.enabled ? (
            <RegistrationChallenge
              siteKey={registrationConfig.site_key}
              action="registration"
              generation={generation}
              onToken={setChallenge}
            />
          ) : (
            <p role="status" className="text-sm text-fg-muted">
              {t(registrationConfig ? 'registration.unavailable' : 'registration.loading')}
            </p>
          )
        )}

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border-default bg-canvas-subtle p-3">
          <input
            type="checkbox"
            required
            checked={agreePolicies}
            onChange={(e) => setAgreePolicies(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-border-default text-success-emphasis focus:ring-success-emphasis"
          />
          <span className="text-sm leading-6 text-[var(--yj-text-muted)]">
            {t('auth.iHaveReadAndUnderstood1d26a6')}{' '}
            <Link
              href={`/privacy?lang=${t.locale}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-success-fg hover:underline"
            >
              {t('auth.privacyPolicya09ce1')}
            </Link>{' '}
            {t('auth.andAgreeToUserAgreement')}{' '}
            <Link
              href={`/agreement?lang=${t.locale}&version=${USER_AGREEMENT_VERSION}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-success-fg hover:underline"
            >
              {t('auth.userAgreement')}
            </Link>
          </span>
        </label>

        <Button
          loading={loading}
          loadingLabel={t("auth.registeringed5c1a")}
          type="submit"
          variant="primary"
          className="yj-public-primary w-full !h-12 !rounded-[var(--yj-radius-control)] !text-base font-medium"
          disabled={
            loading ||
            !agreePolicies ||
            (isSaaS && (!registrationConfig?.enabled || registrationConfig.review_mode !== 'manual' || !challenge))
          }
          leftIcon={loading ? undefined : <UserPlus className="w-4 h-4" />}
        >
          {t("auth.registerda0e5f")}
        </Button>

        <p className="mt-6 text-center text-sm text-[var(--yj-text-muted)]">
          {t("auth.alreadyHaveAnAccountc9bc5e")}{' '}
          <Link
            href={loginHref}
            onClick={(e) => {
              if (loading || isSwitchDisabled) {
                e.preventDefault();
                return;
              }
              if (onSwitchToLogin) {
                e.preventDefault();
                onSwitchToLogin();
              }
            }}
            className={`font-medium text-success-fg hover:underline ${
              loading || isSwitchDisabled ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-disabled={loading || isSwitchDisabled || undefined}
          >
            {t("auth.signIn21f1e8")}
          </Link>
        </p>
      </form>
    </div>
  );
}
