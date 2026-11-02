'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { RegistrationVerification } from '@/components/auth/RegistrationVerification';
import { useAuth } from '@/components/providers/AuthProvider';

export interface LoginPageProps {
  initialMode?: 'login' | 'register';
}

function useOptionalAuth() {
  try {
    return useAuth();
  } catch {
    return null;
  }
}

export default function LoginPage({ initialMode }: LoginPageProps) {
  const router = useRouter();
  const auth = useOptionalAuth();
  const authLoading = auth?.isLoading ?? false;
  const isAuthenticated = auth?.isAuthenticated ?? false;

  const [mode, setMode] = React.useState<'login' | 'register'>(() => {
    if (typeof window !== 'undefined') {
      const urlMode = new URLSearchParams(window.location.search).get('mode');
      if (urlMode === 'register') return 'register';
      if (urlMode === 'login') return 'login';
    }
    return initialMode || 'login';
  });

  const [submitted, setSubmitted] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [isBusy, setIsBusy] = React.useState(false);
  const [switched, setSwitched] = React.useState(false);

  const loginTitleRef = React.useRef<HTMLHeadingElement>(null);
  const registerTitleRef = React.useRef<HTMLHeadingElement>(null);
  const submittedTitleRef = React.useRef<HTMLHeadingElement>(null);

  const accountDeleted = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('accountDeleted') === '1';
  }, []);

  const registeredPending = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('registered') === 'pending';
  }, []);

  const nextParam = React.useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('next');
  }, []);

  const nextPath = React.useMemo(() => {
    return safeNextPath(nextParam);
  }, [nextParam]);

  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(nextPath);
    }
  }, [authLoading, isAuthenticated, nextPath, router]);

  React.useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const targetMode = params.get('mode') === 'register' ? 'register' : 'login';
      setMode(targetMode);
      setSubmitted(false);
      setTimeout(() => {
        if (targetMode === 'register') {
          registerTitleRef.current?.focus();
        } else {
          loginTitleRef.current?.focus();
        }
      }, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const updateUrlMode = React.useCallback(
    (newMode: 'login' | 'register') => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (newMode === 'register') {
        url.searchParams.set('mode', 'register');
      } else {
        url.searchParams.delete('mode');
      }
      const newPath = `${url.pathname}${url.search}${url.hash}`;
      router.push(newPath);
    },
    [router]
  );

  const handleSwitchToRegister = React.useCallback(() => {
    if (isBusy) return;
    setSubmitted(false);
    setMode('register');
    setSwitched(true);
    updateUrlMode('register');
  }, [isBusy, updateUrlMode]);

  const handleSwitchToLogin = React.useCallback(() => {
    if (isBusy) return;
    setSubmitted(false);
    setMode('login');
    setSwitched(true);
    updateUrlMode('login');
  }, [isBusy, updateUrlMode]);

  const handleRegistrationSubmitted = React.useCallback((cleanEmail: string) => {
    setSubmittedEmail(cleanEmail);
    setSubmitted(true);
    setTimeout(() => {
      submittedTitleRef.current?.focus();
    }, 0);
  }, []);

  const registerHref = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set('mode', 'register');
    if (nextParam) params.set('next', nextParam);
    return `/login?${params.toString()}`;
  }, [nextParam]);

  const loginHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (nextParam) params.set('next', nextParam);
    const query = params.toString();
    return query ? `/login?${query}` : '/login';
  }, [nextParam]);

  return (
    <AuthLayout>
      {submitted ? (
        <RegistrationVerification
          initialEmail={submittedEmail || email}
          submitted={true}
          embedded={true}
          actionVariant="button"
          onBackToLogin={handleSwitchToLogin}
          titleRef={submittedTitleRef}
          loginHref={loginHref}
        />
      ) : mode === 'register' ? (
        <RegisterForm
          key="register"
          email={email}
          onEmailChange={setEmail}
          onSwitchToLogin={handleSwitchToLogin}
          loginHref={loginHref}
          isSwitchDisabled={isBusy}
          onLoadingChange={setIsBusy}
          onRegistrationSubmitted={handleRegistrationSubmitted}
          titleRef={registerTitleRef}
          nextPath={nextPath}
        />
      ) : (
        <LoginForm
          key="login"
          email={email}
          onEmailChange={setEmail}
          onSwitchToRegister={handleSwitchToRegister}
          registerHref={registerHref}
          isSwitchDisabled={isBusy}
          onLoadingChange={setIsBusy}
          titleRef={loginTitleRef}
          nextPath={nextPath}
          accountDeleted={accountDeleted}
          registeredPending={registeredPending}
          autoFocusTitle={switched}
        />
      )}
    </AuthLayout>
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
      parsed.pathname === '/register' ||
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
