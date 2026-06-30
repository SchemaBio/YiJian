'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Root page - redirects based on auth status
 */
export default function HomePage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // 显示加载状态
  return (
    <div className="yj-modern yj-public-shell flex items-center justify-center">
      <div className="yj-public-spinner" />
    </div>
  );
}
