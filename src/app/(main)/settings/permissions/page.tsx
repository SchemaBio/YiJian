'use client';

import { PageContent } from '@/components/layout';
import { PermissionsManagement } from '../components/PermissionsManagement';

// 模拟当前用户数据 - 实际应从认证上下文获取
const mockCurrentUser = {
  role: 'admin' as const,
};

export default function SettingsPermissionsPage() {
  const isAdmin = mockCurrentUser.role === 'admin';

  // 非管理员无权访问
  if (!isAdmin) {
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
          <p className="yj-page-subtitle">
            配置组织成员的角色和权限。所有角色都可以查看所有页面，但特定操作权限需要按角色分配。
          </p>
        </div>
      </div>
      <PermissionsManagement />
    </PageContent>
  );
}
