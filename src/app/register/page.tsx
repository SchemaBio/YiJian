'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@schema/ui-kit';
import { UserPlus } from 'lucide-react';
import { ApiError, clearLegacyAuthTokens } from '@/lib/api';
import { hashPassword } from '@/lib/crypto';
import { getRuntimeApiBaseUrl } from '@/lib/runtime-config';

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

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { email, password, name, orgName, orgSlug } = form;
    if (!email || !password || !name || !orgName || !orgSlug) {
      setError('请填写所有必填字段');
      return;
    }

    setLoading(true);
    try {
      const hashedPassword = await hashPassword(password, email);
      const res = await fetch(
        `${getRuntimeApiBaseUrl()}/v1/auth/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email,
            password: hashedPassword,
            name,
            org_name: orgName,
            org_slug: orgSlug,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new ApiError(res.status, res.statusText, json);
      }

      clearLegacyAuthTokens();
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = (err.data as any)?.error || '注册失败';
        setError(msg);
      } else {
        setError('网络错误，请稍后重试');
      }
      setLoading(false);
    }
  };

  return (
    <div className="yj-modern yj-public-shell flex items-center justify-center p-8">
      <div className="yj-panel yj-auth-card yj-auth-single">
        <div className="mb-8">
          <div className="yj-brand-lockup mb-8">
            <span className="yj-brand-mark">
              <Image src="/logo.svg" alt="贻鉴" width={28} height={28} className="object-contain" />
            </span>
            <span>贻鉴</span>
          </div>
          <h2 className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--yj-text-strong)]">创建账号</h2>
          <p className="mt-2 text-sm text-[var(--yj-text-muted)]">注册您的研究团队和账号</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="yj-public-alert rounded-[var(--yj-radius-panel)] p-3.5 text-sm">
              {error}
            </div>
          )}

          <Input
            id="register-name"
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="姓名 *"
            className="!h-12 !rounded-xl text-base shadow-sm transition-shadow focus-within:shadow-md"
          />

          <Input
            id="register-email"
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="邮箱 *"
            autoComplete="email"
            className="!h-12 !rounded-xl text-base shadow-sm transition-shadow focus-within:shadow-md"
          />

          <Input
            id="register-password"
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="密码 *"
            autoComplete="new-password"
            className="!h-12 !rounded-xl text-base shadow-sm transition-shadow focus-within:shadow-md"
          />

          <Input
            id="register-org-name"
            type="text"
            value={form.orgName}
            onChange={(e) => handleChange('orgName', e.target.value)}
            placeholder="团队/机构名称 *"
            className="!h-12 !rounded-xl text-base shadow-sm transition-shadow focus-within:shadow-md"
          />

          <Input
            id="register-org-slug"
            type="text"
            value={form.orgSlug}
            onChange={(e) => handleChange('orgSlug', e.target.value)}
            placeholder="团队标识 (URL slug, 如 mylab) *"
            className="!h-12 !rounded-xl text-base shadow-sm transition-shadow focus-within:shadow-md"
          />

          <Button
            type="submit"
            variant="primary"
            className="yj-public-primary w-full !h-12 !rounded-xl !text-base font-medium transition-shadow"
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
