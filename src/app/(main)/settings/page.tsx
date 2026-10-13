'use client';
import { useText } from '@/i18n/useText';



import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { ProfileSettings } from './components/ProfileSettings';

export default function SettingsProfilePage() {
  const t = useText();
  const { user, currentOrg, isLoading, updateProfile, changePassword } = useAuth();

  if (isLoading) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <p className="text-fg-muted">{t("settings.loadingProfile42b12a")}</p>
        </div>
      </PageContent>
    );
  }

  if (!user) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <p className="text-fg-muted">{t("settings.notSignedInOrSessionExpired2192cf")}</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">{t("settings.personalSettingsf787ab")}</h2>
          <p className="yj-page-subtitle">{t("settings.manageYourProfileOrganizationAndAccountSecurityc0c73c")}</p>
        </div>
      </div>
      <ProfileSettings
        user={user}
        currentOrg={currentOrg}
        onUpdateProfile={updateProfile}
        onChangePassword={changePassword}
      />
    </PageContent>
  );
}
