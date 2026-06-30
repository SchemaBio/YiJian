'use client';

import { PageContent } from '@/components/layout';
import { ProfileSettings } from './components/ProfileSettings';

// 模拟当前用户数据
const mockCurrentUser = {
  id: '1',
  name: '张三',
  email: 'zhangsan@example.com',
  role: 'admin' as const,
};

export default function SettingsProfilePage() {
  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <h2 className="yj-page-title">个人设置</h2>
      </div>
      <ProfileSettings user={mockCurrentUser} />
    </PageContent>
  );
}
