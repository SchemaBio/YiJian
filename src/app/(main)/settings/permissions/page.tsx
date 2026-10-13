'use client';
import { useText } from '@/i18n/useText';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { PermissionsManagement } from '../components/PermissionsManagement';

export default function SettingsPermissionsPage() {
  const t = useText();
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
          <p className="text-fg-muted">{t("settings.checkingPermissions04cb10")}</p>
        </div>
      </PageContent>
    );
  }

  if (!isPlatformAdmin()) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <p className="text-fg-muted">{t("settings.youDoNotHavePermissionToAccessbed2ab")}</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">{t("settings.permissionse47b7f")}</h2>
          <p className="yj-page-subtitle">{t("settings.createSelfHostedUsersAndManageTheir8f13a7")}</p>
        </div>
      </div>
      <PermissionsManagement />
    </PageContent>
  );
}
