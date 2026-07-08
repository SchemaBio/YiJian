'use client';

import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { ProfileSettings } from './components/ProfileSettings';

export default function SettingsProfilePage() {
  const { user, currentOrg, isLoading, updateProfile } = useAuth();

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
        <h2 className="yj-page-title">个人设置</h2>
      </div>
      <ProfileSettings user={user} currentOrg={currentOrg} onUpdateProfile={updateProfile} />
    </PageContent>
  );
}
