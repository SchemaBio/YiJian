'use client';

import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { ProfileSettings } from './components/ProfileSettings';

export default function SettingsProfilePage() {
  const { user, currentOrg, isLoading, updateProfile, changePassword, isPlatformAdmin } = useAuth();

  if (isLoading) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <p className="text-fg-muted">正在加载个人信息...</p>
        </div>
      </PageContent>
    );
  }

  if (!user) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <p className="text-fg-muted">未登录或会话已过期</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">个人设置</h2>
          <p className="yj-page-subtitle">管理个人资料、组织信息和账户安全。</p>
        </div>
      </div>
      {isPlatformAdmin() ? (
        <div className="mb-5 rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] p-4 text-sm text-fg-muted">
          平台管理员请使用 Cuttlefish 控制台管理租户。贻鉴分析工作台仅对机构账号开放，以避免跨租户数据可见。
        </div>
      ) : null}
      <ProfileSettings
        user={user}
        currentOrg={currentOrg}
        onUpdateProfile={updateProfile}
        onChangePassword={changePassword}
      />
    </PageContent>
  );
}
