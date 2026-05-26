'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input } from '@schema/ui-kit';
import { UserPlus } from 'lucide-react';
import { ApiError, setAuthTokens } from '@/lib/api';
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
      const res = await fetch(
        `${getRuntimeApiBaseUrl()}/v1/auth/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email,
            password,
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

      const data = json?.data ?? json;
      if (data.access_token) {
        setAuthTokens(data.access_token, data.refresh_token, data.expires_at);
      }
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
    <div className="min-h-screen flex items-center justify-center bg-canvas-default p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-fg-default">创建账号</h2>
          <p className="text-fg-muted mt-1">注册您的研究团队和账号</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-danger-subtle text-danger-fg text-sm">
              {error}
            </div>
          )}

          <Input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="姓名 *"
            className="h-12"
          />

          <Input
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="邮箱 *"
            autoComplete="email"
            className="h-12"
          />

          <Input
            type="password"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="密码 *"
            autoComplete="new-password"
            className="h-12"
          />

          <Input
            type="text"
            value={form.orgName}
            onChange={(e) => handleChange('orgName', e.target.value)}
            placeholder="团队/机构名称 *"
            className="h-12"
          />

          <Input
            type="text"
            value={form.orgSlug}
            onChange={(e) => handleChange('orgSlug', e.target.value)}
            placeholder="团队标识 (URL slug, 如 mylab) *"
            className="h-12"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
            leftIcon={loading ? undefined : <UserPlus className="w-4 h-4" />}
          >
            {loading ? '注册中...' : '注册'}
          </Button>

          <p className="text-center text-sm text-fg-muted">
            已有账号？{' '}
            <Link href="/login" className="text-success-fg hover:underline">
              登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
