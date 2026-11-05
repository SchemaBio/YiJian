'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { AuthPage } from '@/components/auth/AuthPage';

export default function RegisterPage() {
  const router = useRouter();
  const canRegister = getRuntimeBackendFlavor() === 'squid';

  React.useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    if (canRegister) params.set('mode', 'register');
    else params.delete('mode');
    const query = params.toString();
    const redirectFn = router.replace || router.push;
    if (typeof redirectFn === 'function') {
      redirectFn.call(router, query ? `/login?${query}` : '/login');
    }
  }, [router, canRegister]);

  return canRegister ? <AuthPage initialMode="register" /> : null;
}
