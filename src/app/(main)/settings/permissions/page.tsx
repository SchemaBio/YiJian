'use client';

import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { PermissionsManagement } from '../components/PermissionsManagement';

export default function SettingsPermissionsPage() {
  const { isLoading, isPlatformAdmin } = useAuth();

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
          <p className="yj-page-subtitle">管理 Squid SaaS 账号的系统角色与启停状态。</p>
        </div>
      </div>
      <PermissionsManagement />
    </PageContent>
  );
}
