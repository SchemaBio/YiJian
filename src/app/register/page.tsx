'use client';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';
import { useText } from '@/i18n/useText';
import { errorText } from '@/i18n/errors';


import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@schema/ui-kit';
import { UserPlus } from 'lucide-react';
import { api, ApiError, clearLegacyAuthTokens } from '@/lib/api';
import { hashPassword } from '@/lib/crypto';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { RegistrationChallenge, useRegistrationAvailability } from '@/components/auth/RegistrationChallenge';
import { RegistrationVerification } from '@/components/auth/RegistrationVerification';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

const ORG_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export default function RegisterPage() {
  const t = useText();
  const router = useRouter();
  const [form, setForm] = React.useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    orgName: '',
    orgSlug: '',
  });
  const [confirmationTouched, setConfirmationTouched] = React.useState(false);
  const confirmationError = confirmationTouched
    ? !form.confirmPassword ? t('auth.completeAllRequiredFields61d4e1')
      : form.password !== form.confirmPassword ? t('auth.registrationPasswordsMismatch') : ''
    : '';
  const [agreePolicies, setAgreePolicies] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const backendFlavor = getRuntimeBackendFlavor();
  const isSaaS = backendFlavor === 'squid';
  const registrationConfig = useRegistrationAvailability(isSaaS);
  const [challenge, setChallenge] = React.useState('');
  const [generation, setGeneration] = React.useState(0);
  const [submitted, setSubmitted] = React.useState(false);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmationTouched(true);

    const email = form.email.trim().toLowerCase();
    const password = form.password;
    const name = form.name.trim();
    const orgName = form.orgName.trim();
    const orgSlug = form.orgSlug.trim().toLowerCase();

    if (!email || !password || !form.confirmPassword) {
      setError(t("auth.completeAllRequiredFields61d4e1"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.passwordMustHaveAtLeastCharactersb6a69b"));
      return;
    }

    if (password !== form.confirmPassword) {
      setError(t('auth.registrationPasswordsMismatch'));
      return;
    }

    if (orgSlug && !ORG_SLUG_PATTERN.test(orgSlug)) {
      setError(t("auth.organizationSlugMustBeLowercaseLettersDigitsdff5c0"));
      return;
    }

    if (!agreePolicies) { setError(t('auth.acknowledgePrivacyAndAgreeToTerms')); return; }

    if (isSaaS && (!registrationConfig?.enabled || registrationConfig.review_mode !== 'manual' || !challenge)) { setError(t('registration.unavailable')); return; }
    setLoading(true);
    try {
      const hashedPassword = await hashPassword(password, email);
      const response = await api.post<{ access_token?: string; message?: string }>('/v1/auth/register', {
        email,
        ...(isSaaS ? { turnstile_token: challenge, locale: t.locale } : {}),
        password: hashedPassword,
        ...(name ? { name } : {}),
        ...(orgName ? { org_name: orgName } : {}),
        ...(orgSlug ? { org_slug: orgSlug } : {}),
      }, { coreApi: false });

      clearLegacyAuthTokens();
      if (!response?.access_token && response?.message) {
        if (isSaaS) { setSubmitted(true); setLoading(false); return; }
        router.push('/login?registered=pending');
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = (err.data as any)?.error || (err.data as any)?.message || t("auth.registrationFaileda1d7fb");
        setError(errorText(String(msg), t));
      } else {
        setError(t("auth.networkErrorRetryLatereb9dcb"));
      }
      setChallenge(''); setGeneration(value => value + 1);
      setLoading(false);
    }
  };

  if (submitted) return <RegistrationVerification initialEmail={form.email.trim().toLowerCase()} submitted />;

  return (
    <div className="yj-modern yj-public-shell flex items-center justify-center px-4 py-8 sm:p-8">
      <LanguageSwitcher />
      <div className="yj-panel yj-auth-card yj-auth-single">
        <div className="mb-8">
          <div className="yj-brand-lockup mb-8">
            <span className="yj-brand-mark">
              <Image src="/logo.svg" alt="YiJian" width={28} height={28} className="object-contain" />
            </span>
            <span>YiJian</span>
          </div>
          <h2 className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--yj-text-strong)]">{t("auth.createAccount4742b5")}</h2>
          <p className="mt-2 text-sm text-[var(--yj-text-muted)]">
            {isSaaS ? t("auth.createATeamAccountAdministratorApprovalIsf98187") : t("auth.createAnAccountToStartUsingYijian2be3bc")}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[var(--yj-text-muted)]">{t(backendFlavor === 'squid' ? 'research.audience' : 'research.selfHostedScope')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="yj-public-alert rounded-[var(--yj-radius-panel)] p-3.5 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="register-email" className="block text-sm font-medium text-[var(--yj-text-strong)]">{t("settings.email9ed627")} <span aria-hidden="true" className="text-danger-fg">*</span></label>
          <Input
            id="register-email"
            aria-label={t("settings.email9ed627")}
            type="email"
            required
            maxLength={100}
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder={t("auth.emailf1f231")}
            autoComplete="email"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-password" className="block text-sm font-medium text-[var(--yj-text-strong)]">{t("auth.passwordAtLeastCharacters692b63")} <span aria-hidden="true" className="text-danger-fg">*</span></label>
          <Input
            id="register-password"
            aria-label={t("auth.passwordAtLeastCharacters692b63")}
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder={t("auth.passwordAtLeastCharacters8adf42")}
            autoComplete="new-password"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-confirm-password" className="block text-sm font-medium text-[var(--yj-text-strong)]">{t('auth.registrationConfirmPassword')} <span aria-hidden="true" className="text-danger-fg">*</span></label>
          <Input
            id="register-confirm-password"
            aria-label={t('auth.registrationConfirmPassword')}
            type="password"
            required
            aria-required="true"
            aria-invalid={!!confirmationError}
            aria-describedby={confirmationError ? "register-confirm-password-error" : undefined}
            onBlur={() => setConfirmationTouched(true)}
            minLength={8}
            value={form.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            placeholder={t('auth.registrationConfirmPassword')}
            autoComplete="new-password"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
            {confirmationError && <p id="register-confirm-password-error" className="text-sm text-danger-fg" aria-live="polite">{confirmationError}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="register-name" className="block text-sm font-medium text-[var(--yj-text-strong)]">{t('auth.registrationNameOptional')}</label>
          <Input
            id="register-name"
            aria-label={t('auth.registrationNameOptional')}
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={t('auth.registrationNameOptional')}
            autoComplete="name"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-org-name" className="block text-sm font-medium text-[var(--yj-text-strong)]">{t("auth.teamOrganizationNameOptionalfc3dfe")}</label>
          <Input
            id="register-org-name"
            aria-label={t("auth.teamOrganizationNameOptionalfc3dfe")}
            type="text"
            value={form.orgName}
            onChange={(e) => handleChange('orgName', e.target.value)}
            placeholder={t("auth.teamOrganizationNameOptionalfc3dfe")}
            autoComplete="organization"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-org-slug" className="block text-sm font-medium text-[var(--yj-text-strong)]">{t("auth.organizationSlugOptional2da1c3")}</label>
          <Input
            id="register-org-slug"
            aria-label={t("auth.organizationSlugOptional2da1c3")}
            type="text"
            value={form.orgSlug}
            onChange={(e) => handleChange('orgSlug', e.target.value)}
            placeholder={t("auth.organizationSlugOptional2da1c3")}
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />
          </div>

          {isSaaS && (registrationConfig?.enabled ? <RegistrationChallenge siteKey={registrationConfig.site_key} action="registration" generation={generation} onToken={setChallenge} /> : <p role="status" className="text-sm text-fg-muted">{t(registrationConfig ? 'registration.unavailable' : 'registration.loading')}</p>)}

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border-default bg-canvas-subtle p-3">
            <input type="checkbox" required checked={agreePolicies} onChange={e => setAgreePolicies(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-border-default text-success-emphasis focus:ring-success-emphasis" />
            <span className="text-sm leading-6 text-[var(--yj-text-muted)]">
              {t('auth.iHaveReadAndUnderstood1d26a6')}{' '}
              <Link href={`/privacy?lang=${t.locale}`} target="_blank" rel="noopener noreferrer" className="font-medium text-success-fg hover:underline">{t('auth.privacyPolicya09ce1')}</Link>{' '}
              {t('auth.andAgreeToUserAgreement')}{' '}
              <Link href={`/agreement?lang=${t.locale}&version=${USER_AGREEMENT_VERSION}`} target="_blank" rel="noopener noreferrer" className="font-medium text-success-fg hover:underline">{t('auth.userAgreement')}</Link>
            </span>
          </label>

          <Button loading={loading} loadingLabel={t("auth.registeringed5c1a")}
            type="submit"
            variant="primary"
            className="yj-public-primary w-full !h-12 !rounded-[var(--yj-radius-control)] !text-base font-medium"
            disabled={loading || !agreePolicies || (isSaaS && (!registrationConfig?.enabled || registrationConfig.review_mode !== 'manual' || !challenge))}
            leftIcon={loading ? undefined : <UserPlus className="w-4 h-4" />}
          >
            {t("auth.registerda0e5f")}</Button>

          <p className="text-center text-sm text-fg-muted">
            {t("auth.alreadyHaveAnAccountc9bc5e")}{' '}
            <Link href="/login" className="font-medium text-success-fg hover:underline">
              {t("auth.signIn21f1e8")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
