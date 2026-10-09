'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@schema/ui-kit';
import { UserPlus } from 'lucide-react';
import { api, ApiError, clearLegacyAuthTokens } from '@/lib/api';
import { hashPassword } from '@/lib/crypto';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

const ORG_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export default function RegisterPage() {
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
      setError('请填写所有必填字段');
      return;
    }

    if (password.length < 8) {
      setError('密码至少需要 8 位');
      return;
    }

    if (orgSlug && !ORG_SLUG_PATTERN.test(orgSlug)) {
      setError('机构标识需为 3-64 位小写字母、数字或连字符，并以字母或数字开头和结尾');
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
        const msg = (err.data as any)?.error || (err.data as any)?.message || '注册失败';
        setError(String(msg));
      } else {
        setError('网络错误，请稍后重试');
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
          <h2 className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--yj-text-strong)]">创建账号</h2>
          <p className="mt-2 text-sm text-[var(--yj-text-muted)]">
            {requireOrgFields ? '创建团队账号，提交后等待管理员审批。' : '创建账号，开始使用贻鉴。'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="yj-public-alert rounded-[var(--yj-radius-panel)] p-3.5 text-sm">
              {error}
            </div>
          )}

          <Input
            id="register-name"
            aria-label="姓名"
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="姓名 *"
            autoComplete="name"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Input
            id="register-email"
            aria-label="邮箱"
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="邮箱 *"
            autoComplete="email"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Input
            id="register-password"
            aria-label="密码（至少 8 位）"
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="密码（至少 8 位）*"
            autoComplete="new-password"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Input
            id="register-org-name"
            aria-label="团队/机构名称"
            type="text"
            value={form.orgName}
            onChange={(e) => handleChange('orgName', e.target.value)}
            placeholder={requireOrgFields ? '团队/机构名称 *' : '团队/机构名称（选填）'}
            autoComplete="organization"
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Input
            id="register-org-slug"
            aria-label="机构标识"
            type="text"
            value={form.orgSlug}
            onChange={(e) => handleChange('orgSlug', e.target.value)}
            placeholder={requireOrgFields ? '机构标识（如 my-lab）*' : '机构标识（选填）'}
            className="!h-12 !rounded-[var(--yj-radius-control)] text-base"
          />

          <Button
            type="submit"
            variant="primary"
            className="yj-public-primary w-full !h-12 !rounded-[var(--yj-radius-control)] !text-base font-medium"
            disabled={loading}
            leftIcon={loading ? undefined : <UserPlus className="w-4 h-4" />}
          >
            {loading ? '注册中...' : '注册'}
          </Button>

          <p className="text-center text-sm text-fg-muted">
            已有账号？{' '}
            <Link href="/login" className="font-medium text-success-fg hover:underline">
              登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
