'use client';
import { useText } from '@/i18n/useText';


import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@schema/ui-kit';
import { UserPlus } from 'lucide-react';
import { api, ApiError, clearLegacyAuthTokens } from '@/lib/api';
import { hashPassword } from '@/lib/crypto';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

const ORG_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export default function RegisterPage() {
  const t = useText();
  const router = useRouter();
  const [form, setForm] = React.useState({
    email: '',
    password: '',
    name: '',
    orgName: '',
    orgSlug: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const backendFlavor = getRuntimeBackendFlavor();
  const requireOrgFields = backendFlavor === 'squid';

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const email = form.email.trim().toLowerCase();
    const password = form.password;
    const name = form.name.trim();
    const orgName = form.orgName.trim();
    const orgSlug = form.orgSlug.trim().toLowerCase();

    if (!email || !password || !name || (requireOrgFields && (!orgName || !orgSlug))) {
      setError(t("auth.completeAllRequiredFields61d4e1"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.passwordMustHaveAtLeastCharactersb6a69b"));
      return;
    }

    if (orgSlug && !ORG_SLUG_PATTERN.test(orgSlug)) {
      setError(t("auth.organizationSlugMustBeLowercaseLettersDigitsdff5c0"));
      return;
    }

    setLoading(true);
    try {
      const hashedPassword = await hashPassword(password, email);
      const response = await api.post<{ access_token?: string; message?: string }>('/v1/auth/register', {
        email,
        password: hashedPassword,
        name,
        ...(orgName ? { org_name: orgName } : {}),
        ...(orgSlug ? { org_slug: orgSlug } : {}),
      }, { coreApi: false });

      clearLegacyAuthTokens();
      if (!response?.access_token && response?.message) {
        router.push('/login?registered=pending');
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = (err.data as any)?.error || (err.data as any)?.message || t("auth.registrationFaileda1d7fb");
        setError(String(msg));
      } else {
        setError(t("auth.networkErrorRetryLatereb9dcb"));
      }
      setLoading(false);
    }
  };

  return (
    <div className="yj-modern yj-public-shell flex items-center justify-center px-4 py-8 sm:p-8">
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
            {requireOrgFields ? t("auth.createATeamAccountAdministratorApprovalIsf98187") : t("auth.createAnAccountToStartUsingYijian2be3bc")}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[var(--yj-text-muted)]">{t(backendFlavor === 'squid' ? 'research.audience' : 'research.selfHostedScope')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="yj-public-alert rounded-[var(--yj-radius-panel)] p-3.5 text-sm">
              {error}
            </div>
          )}

          <Input
            id="register-name"
            aria-label={t("samples.namebe4c26")}
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={t("samples.name2b9e1a")}
            autoComplete="name"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Input
            id="register-email"
            aria-label={t("settings.email9ed627")}
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder={t("auth.emailf1f231")}
            autoComplete="email"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Input
            id="register-password"
            aria-label={t("auth.passwordAtLeastCharacters692b63")}
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder={t("auth.passwordAtLeastCharacters8adf42")}
            autoComplete="new-password"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Input
            id="register-org-name"
            aria-label={t("auth.teamOrganizationNamea2fbbb")}
            type="text"
            value={form.orgName}
            onChange={(e) => handleChange('orgName', e.target.value)}
            placeholder={requireOrgFields ? t("auth.teamOrganizationName265315") : t("auth.teamOrganizationNameOptionalfc3dfe")}
            autoComplete="organization"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Input
            id="register-org-slug"
            aria-label={t("auth.organizationSlugc4ef74")}
            type="text"
            value={form.orgSlug}
            onChange={(e) => handleChange('orgSlug', e.target.value)}
            placeholder={requireOrgFields ? t("auth.organizationSlugEGMyLab16fa51") : t("auth.organizationSlugOptional2da1c3")}
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Button loading={loading} loadingLabel={t("auth.registeringed5c1a")}
            type="submit"
            variant="primary"
            className="yj-public-primary w-full !h-12 !rounded-[var(--yj-radius-control)] !text-base font-medium"
            disabled={loading}
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
