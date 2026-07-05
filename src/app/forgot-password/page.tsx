'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@schema/ui-kit';
import { Mail } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { authApi } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('请输入邮箱地址');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.forgotPassword(trimmedEmail);
      setMessage(response.message || '如果该邮箱存在，系统会发送密码重置链接。');
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { error?: string } | null;
        setError(data?.error || '发送重置请求失败');
      } else {
        setError('网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="yj-modern yj-public-shell flex min-h-screen items-center justify-center p-8">
      <div className="yj-panel yj-auth-card yj-auth-single">
        <div className="mb-8">
          <div className="yj-brand-lockup mb-8">
            <span className="yj-brand-mark">
              <Image src="/logo.svg" alt="YiJian" width={28} height={28} className="object-contain" />
            </span>
            <span>YiJian</span>
          </div>
          <h2 className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--yj-text-strong)]">找回密码</h2>
          <p className="mt-2 text-sm text-[var(--yj-text-muted)]">
            输入账号邮箱后，前端会调用 Squid `/api/v1/auth/forgot-password` 发起真实重置流程。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="yj-public-alert rounded-[var(--yj-radius-panel)] p-3.5 text-sm">{error}</div>}
          {message && (
            <div className="rounded-[var(--yj-radius-panel)] border border-success-muted bg-success-subtle p-3.5 text-sm text-success-fg">
              {message}
            </div>
          )}

          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            autoComplete="email"
            autoFocus
            disabled={loading}
            className="!h-12 !rounded-xl text-base shadow-sm"
          />

          <Button
            type="submit"
            variant="primary"
            className="yj-public-primary w-full !h-12 !rounded-xl !text-base font-medium"
            disabled={loading}
            leftIcon={loading ? undefined : <Mail className="h-4 w-4" />}
          >
            {loading ? '发送中...' : '发送重置链接'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--yj-text-muted)]">
          已有重置 token？{' '}
          <Link href="/reset-password" className="font-medium text-success-fg hover:underline">
            设置新密码
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-[var(--yj-text-muted)]">
          <Link href="/login" className="font-medium text-success-fg hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
