'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@schema/ui-kit';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError } from '@/lib/api';
import { DnaHelix } from '@/components/DnaHelix';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading: authLoading, isAuthenticated } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [agreePrivacy, setAgreePrivacy] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const privacyConsentRequired = process.env.NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED !== 'false';
  const accountDeleted = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('accountDeleted') === '1';
  }, []);
  const nextPath = React.useMemo(() => {
    if (typeof window === 'undefined') return '/dashboard';
    return safeNextPath(new URLSearchParams(window.location.search).get('next'));
  }, []);

  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(nextPath);
    }
  }, [authLoading, isAuthenticated, nextPath, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    if (privacyConsentRequired && !agreePrivacy) {
      setError('请阅读并同意用户隐私协议');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      router.push(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { error?: string } | null;
        setError(data?.error || '登录失败，请检查邮箱和密码');
      } else {
        setError('网络错误，请稍后重试');
      }
      setLoading(false);
    }
  };

  return (
    <div className="yj-modern yj-public-shell flex min-h-screen">
      <div
        className="relative hidden items-center justify-center overflow-hidden bg-[var(--yj-panel-subtle)] lg:flex lg:w-1/2 xl:w-3/5"
        style={{ color: 'rgba(26, 127, 55, 0.28)' }}
      >
        <DnaHelix />
      </div>

      <div className="flex flex-1 items-center justify-center bg-[var(--yj-panel-bg)] p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--yj-panel-subtle)] shadow-sm">
              <Image
                src="/logo.svg"
                alt="YiJian"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <h1 className="text-2xl font-semibold text-[var(--yj-text-strong)]">YiJian</h1>
            <p className="mt-1 text-[var(--yj-text-muted)]">遗传病胚系突变分析平台</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-[var(--yj-text-strong)]">贻鉴分析平台</h2>
            <p className="mt-1 text-[var(--yj-text-muted)]">请登录您的账号</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form space-y-5">
            {accountDeleted && !error && (
              <div className="rounded-md border border-success-muted bg-success-subtle p-3.5 text-sm text-success-fg">
                账户已删除，当前会话已安全退出。
              </div>
            )}
            {error && (
              <div className="yj-public-alert rounded-xl p-3.5 text-sm">
                {error}
              </div>
            )}

            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              autoComplete="email"
              autoFocus
              className="!h-12 !rounded-xl text-base shadow-sm transition-shadow focus-within:shadow-md"
            />

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete="current-password"
                className="!h-12 !rounded-xl text-base shadow-sm transition-shadow focus-within:shadow-md"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted transition-colors hover:text-fg-default"
                tabIndex={-1}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded-md border-border-default text-success-emphasis focus:ring-success-emphasis"
                />
                <span className="text-[var(--yj-text-muted)]">记住我</span>
              </label>
              <Link href="/forgot-password" className="text-success-fg hover:underline">
                忘记密码？
              </Link>
            </div>

            {privacyConsentRequired && (
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-md border-border-default text-success-emphasis focus:ring-success-emphasis"
                />
                <span className="text-sm leading-relaxed text-[var(--yj-text-muted)]">
                  我已阅读并同意{' '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-success-fg hover:underline">
                    《用户隐私协议与免责声明》
                  </Link>
                </span>
              </label>
            )}

            <Button
              type="submit"
              variant="primary"
              className="yj-public-primary w-full !h-12 !rounded-xl !text-base font-medium transition-shadow"
              disabled={loading || (privacyConsentRequired && !agreePrivacy)}
              leftIcon={loading ? undefined : <LogIn className="h-4 w-4" />}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--yj-text-muted)]">
            没有账号？{' '}
            <Link href="/register" className="font-medium text-success-fg hover:underline">
              注册
            </Link>
          </p>

          <p className="mt-8 text-center text-xs text-[var(--yj-text-muted)] lg:hidden">
            © 2024 SchemaBio. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

function safeNextPath(value: string | null): string {
  if (!value) return '/dashboard';
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return '/dashboard';
  }
  try {
    const parsed = new URL(value, 'http://yijian.local');
    if (
      parsed.origin !== 'http://yijian.local' ||
      parsed.pathname === '/login' ||
      hasUnsafeRedirectPath(parsed.pathname)
    ) {
      return '/dashboard';
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/dashboard';
  }
}

function hasUnsafeRedirectPath(pathname: string): boolean {
  for (const segment of pathname.split('/').filter(Boolean)) {
    const decoded = decodePathSegment(segment);
    if (decoded === null) {
      return true;
    }
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      /[\u0000-\u001f]/.test(decoded)
    ) {
      return true;
    }
  }
  return false;
}

function decodePathSegment(segment: string): string | null {
  let decoded = segment;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded;
}
