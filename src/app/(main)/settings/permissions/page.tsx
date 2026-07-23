'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { PermissionsManagement } from '../components/PermissionsManagement';

export default function SettingsPermissionsPage() {
  const router = useRouter();
  const { isLoading, isPlatformAdmin } = useAuth();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';

  React.useEffect(() => {
    if (isSaaS) router.replace('/settings');
  }, [isSaaS, router]);

  if (isSaaS) return null;

  if (isLoading) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <p className="text-fg-muted">正在验证权限...</p>
        </div>
      </PageContent>
    );
  }

  if (!isPlatformAdmin()) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <p className="text-fg-muted">您没有权限访问此页面</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">权限管理</h2>
          <p className="yj-page-subtitle">创建自部署子用户，并管理其角色与账号状态。</p>
        </div>
      </div>
      <PermissionsManagement />
    </PageContent>
  );
}
