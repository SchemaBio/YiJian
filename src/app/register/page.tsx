'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AuthPage } from '@/components/auth/AuthPage';

export default function RegisterPage() {
  const router = useRouter();

  React.useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    params.set('mode', 'register');
    const redirectFn = router.replace || router.push;
    if (typeof redirectFn === 'function') {
      redirectFn.call(router, `/login?${params.toString()}`);
    }
  }, [router]);

  return <AuthPage initialMode="register" />;
}
