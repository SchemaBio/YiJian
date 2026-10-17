'use client';
import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { useText } from '@/i18n/useText';
import { PermissionsManagement } from '../settings/components/PermissionsManagement';

export default function AdminPage() {
  const t = useText();
  const { user, isLoading, isPlatformAdmin } = useAuth();
  if (isLoading || !isPlatformAdmin() || getRuntimeBackendFlavor() === 'squid') {
    return <PageContent className="yj-page-shell"><div className="yj-empty-state">
      <p className="text-fg-muted">{t(isLoading ? 'settings.checkingPermissions04cb10' : 'settings.youDoNotHavePermissionToAccessbed2ab')}</p>
    </div></PageContent>;
  }
  return <PageContent className="yj-page-shell">
    <div className="yj-page-header"><div>
      <h2 className="yj-page-title">{t('admin.platformAdministrationa475a9')}</h2>
      <p className="yj-page-subtitle">{t('settings.accountManagementDescription')}</p>
    </div></div>
    <PermissionsManagement currentUserId={user?.id} />
  </PageContent>;
}
