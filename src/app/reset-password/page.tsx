'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@schema/ui-kit';
import { KeyRound } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { authApi } from '@/lib/auth';
import { hashPassword, isPasswordHashEnabled } from '@/lib/crypto';

const PASSWORD_HASH_ENABLED = isPasswordHashEnabled();

export default function ResetPasswordPage() {
  const [token, setToken] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
    setEmail(params.get('email') || '');
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError('请输入重置 token');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (PASSWORD_HASH_ENABLED && !normalizedEmail) {
      setError('当前部署启用了前端密码哈希，请输入账号邮箱以生成与 Squid 登录流程一致的新密码摘要');
      return;
    }
    if (password.length < 8) {
      setError('新密码至少需要 8 个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      const preparedPassword = PASSWORD_HASH_ENABLED
        ? await hashPassword(password, normalizedEmail)
        : password;
      const response = await authApi.resetPassword(trimmedToken, preparedPassword);
      setMessage(response.message || '密码已重置，请返回登录。');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { error?: string } | null;
        setError(data?.error || '重置密码失败');
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
          <h2 className="text-[28px] font-semibold leading-tight tracking-normal text-[var(--yj-text-strong)]">设置新密码</h2>
          <p className="mt-2 text-sm text-[var(--yj-text-muted)]">
            本页调用 Squid `/api/v1/auth/reset-password`，不会在浏览器本地伪造密码修改成功。
            {PASSWORD_HASH_ENABLED ? ' 当前部署已启用前端密码哈希，需要账号邮箱参与哈希。' : ''}
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
            id="reset-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="重置 token"
            autoComplete="one-time-code"
            disabled={loading}
            className="!h-12 !rounded-xl text-base shadow-sm"
          />
          {PASSWORD_HASH_ENABLED && (
            <Input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="账号邮箱（用于生成密码哈希）"
              autoComplete="email"
              disabled={loading}
              className="!h-12 !rounded-xl text-base shadow-sm"
            />
          )}
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码（至少 8 位）"
            autoComplete="new-password"
            disabled={loading}
            className="!h-12 !rounded-xl text-base shadow-sm"
          />
          <Input
            id="confirm-new-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入新密码"
            autoComplete="new-password"
            disabled={loading}
            className="!h-12 !rounded-xl text-base shadow-sm"
          />

          <Button
            type="submit"
            variant="primary"
            className="yj-public-primary w-full !h-12 !rounded-xl !text-base font-medium"
            disabled={loading}
            leftIcon={loading ? undefined : <KeyRound className="h-4 w-4" />}
          >
            {loading ? '提交中...' : '重置密码'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--yj-text-muted)]">
          没有 token？{' '}
          <Link href="/forgot-password" className="font-medium text-success-fg hover:underline">
            重新发送重置链接
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
