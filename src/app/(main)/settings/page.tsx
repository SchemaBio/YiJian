'use client';

import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { ProfileSettings } from './components/ProfileSettings';
import { useRouter } from 'next/navigation';

export default function SettingsProfilePage() {
  const router = useRouter();
  const { user, currentOrg, isLoading, updateProfile, deleteAccount } = useAuth();

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
      <ProfileSettings
        user={user}
        currentOrg={currentOrg}
        onUpdateProfile={updateProfile}
        onDeleteAccount={async (email) => {
          await deleteAccount(email);
          router.replace('/login?accountDeleted=1');
        }}
      />
    </PageContent>
  );
}
