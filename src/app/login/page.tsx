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
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const privacyConsentRequired = process.env.NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED !== 'false';

  // Redirect if already authenticated
  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

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
      router.push('/dashboard');
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
    <div className="min-h-screen flex">
      {/* 左侧 - 品牌展示区 */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden items-center justify-center bg-canvas-subtle">
        {/* DNA 双螺旋动画 */}
        <div className="absolute inset-0 text-accent-emphasis/20">
          <DnaHelix />
        </div>
      </div>

      {/* 右侧 - 登录表单区 */}
      <div className="flex-1 flex items-center justify-center bg-canvas-default p-8">
        <div className="w-full max-w-md">
          {/* 移动端 Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-canvas-subtle rounded-2xl mb-4 shadow-sm">
              <Image
                src="/logo.svg"
                alt="Schema"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <h1 className="text-2xl font-semibold text-fg-default">绳墨生物</h1>
            <p className="text-fg-muted mt-1">遗传病基因组分析系统</p>
          </div>

          {/* 登录标题 */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-fg-default">贻鉴分析平台</h2>
            <p className="text-fg-muted mt-1">请登录您的账号</p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="login-form space-y-5">
            {/* 错误提示 */}
            {error && (
              <div className="p-3.5 rounded-xl bg-danger-subtle text-danger-fg text-sm">
                {error}
              </div>
            )}

            {/* 用户名 */}
            <div>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
                autoComplete="email"
                autoFocus
                className="!rounded-2xl !h-12 text-base shadow-sm transition-shadow focus-within:shadow-md !pl-5 pr-12"
              />
            </div>

            {/* 密码 */}
            <div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  autoComplete="current-password"
                  className="!rounded-2xl !h-12 text-base shadow-sm transition-shadow focus-within:shadow-md !pl-5 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-default transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 记住我 & 忘记密码 */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded-md border-border-default text-success-emphasis focus:ring-success-emphasis"
                />
                <span className="text-fg-muted">记住我</span>
              </label>
              <button type="button" className="text-success-fg hover:underline">
                忘记密码？
              </button>
            </div>

            {/* 用户隐私协议 */}
            {privacyConsentRequired && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="w-4 h-4 rounded-md border-border-default text-success-emphasis focus:ring-success-emphasis mt-0.5"
                />
                <span className="text-sm text-fg-muted leading-relaxed">
                  我已阅读并同意{' '}
                  <Link href="/privacy" target="_blank" className="text-success-fg hover:underline font-medium">
                    《用户隐私协议与免责声明》
                  </Link>
                </span>
              </label>
            )}

            {/* 登录按钮 */}
            <Button
              type="submit"
              variant="primary"
              className="w-full !rounded-2xl !h-12 !text-base font-medium shadow-sm hover:shadow-md transition-shadow"
              disabled={loading || (privacyConsentRequired && !agreePrivacy)}
              leftIcon={loading ? undefined : <LogIn className="w-4 h-4" />}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>

          {/* 注册入口 */}
          <p className="text-center text-sm text-fg-muted mt-6">
            没有账号？{' '}
            <Link href="/register" className="text-success-fg hover:underline font-medium">
              注册
            </Link>
          </p>

          {/* 移动端底部信息 */}
          <p className="lg:hidden text-center text-xs text-fg-muted mt-8">
            © 2024 绳墨生物科技. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
