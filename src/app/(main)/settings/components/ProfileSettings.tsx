'use client';
﻿
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { SupportDialog } from '@/components/support/SupportDialog';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import { FormItem, Input } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { AlertTriangle, Building2, KeyRound, UserRound } from 'lucide-react';
import { AISettingsPanel } from '@/components/shared/AISettingsPanel';
import type { User, UserOrganizationInfo } from '@/types/user';
import { LanguageSettings } from './LanguageSettings';

interface ProfileSettingsProps {
  user: User;
  currentOrg: UserOrganizationInfo | null;
  onUpdateProfile: (data: { name: string }) => Promise<User>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

function roleLabel(role: User['systemRole'], t: TextTranslator = chineseText): string {
  return role === 'PLATFORM_ADMIN' ? t("settings.platformAdministrator02926d") : t("settings.organizationUser568bac");
}

function formatTime(value?: string, t: TextTranslator = chineseText): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(t.locale, { hour12: false });
}

export function ProfileSettings({ user, currentOrg, onUpdateProfile, onChangePassword }: ProfileSettingsProps) {
  const t = useText();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [name, setName] = React.useState(user.name);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setName(user.name);
  }, [user.name]);

  const handleSave = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setError(t("settings.nameCannotBeEmptyb0f813"));
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onUpdateProfile({ name: nextName });
      setMessage(t("settings.profileSaved4695fe"));
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("settings.unableToSaveProfilece9d35"));
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = name.trim() !== user.name;
  const handleChangePassword = async () => {
    setPasswordMessage(null);
    setPasswordError(null);
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("settings.completeAllPasswordFieldsddcb32"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("settings.newPasswordMustHaveAtLeastCharactersb62e70"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.newPasswordsDoNotMatchd0b9c5"));
      return;
    }
    setIsChangingPassword(true);
    try {
      await onChangePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(t("settings.passwordUpdatedOtherSessionsHaveExpired474a27"));
    } catch (err) {
      setPasswordError(err instanceof Error ? errorText(err, t) : t("settings.unableToChangePassword528481"));
    } finally {
      setIsChangingPassword(false);
    }
  };
  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
      <LanguageSettings />
      <section className="yj-panel p-5 lg:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <UserRound className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">{t("settings.accountInformationaf0adf")}</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
          <FormItem label={t("samples.namebe4c26")} className="col-span-2 md:col-span-1">
            <Input aria-label={t("samples.namebe4c26")} value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving} />
          </FormItem>
          <ReadOnlyField label={t("settings.email9ed627")}>{user.email}</ReadOnlyField>
          <FormItem label={t("settings.systemRole97946d")}>
            <div className="h-10 flex items-center">
              <Tag variant={user.systemRole === 'PLATFORM_ADMIN' ? 'warning' : 'info'}>{roleLabel(user.systemRole, t)}</Tag>
            </div>
          </FormItem>
          <FormItem label={t("settings.accountStatus67104f")}>
            <div className="h-10 flex items-center">
              <Tag variant={user.isActive ? 'success' : 'neutral'}>{user.isActive ? t("admin.enabledd4e9ca") : t("admin.disabledd989e5")}</Tag>
            </div>
          </FormItem>
          <ReadOnlyField label={t("settings.registrationApproval69b292")}>{user.approvalStatus === 'approved' ? t("settings.approved4b3c96") : user.approvalStatus === 'pending' ? t("settings.awaitingApproval57fce0") : user.approvalStatus === 'rejected' ? t("settings.rejected349c9e") : '—'}</ReadOnlyField>
          <ReadOnlyField label={t("admin.createdAt84e380")}>{formatTime(user.createdAt, t)}</ReadOnlyField>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--yj-border-subtle)] pt-4">
          <Button action="save"
            variant="primary"
            className="min-w-[124px] justify-center"

            onClick={() => void handleSave()}
            disabled={!isDirty || isSaving}
          >
            {t("settings.saveProfile33f24b")}</Button>
          {message && <span role="status" className="text-sm text-success-fg">{message}</span>}
          {error && <span role="alert" className="text-sm text-danger-fg">{error}</span>}
        </div>
      </section>

      {currentOrg && <section className="yj-panel p-5">
        <div className="mb-5 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">{t("settings.currentOrganizationeca974")}</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadOnlyField label={t("admin.organizationNamec50f05")}>{currentOrg?.name ?? '—'}</ReadOnlyField>
          <ReadOnlyField label={t("settings.organizationIdentifierfc5b24")} mono>{currentOrg?.id ?? '—'}</ReadOnlyField>
        </div>
      </section>}

      <AISettingsPanel admin={user.systemRole === 'PLATFORM_ADMIN'} />

      <section className="yj-panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">{t("settings.accountSecurity178774")}</h3>
            <p className="mt-1 text-xs text-fg-muted">{t("settings.verifyYourCurrentPasswordBeforeSettingA28bc19")}</p>
          </div>
        </div>
        <div className="grid max-w-md grid-cols-1 gap-3">
          <FormItem label={t("settings.currentPassword33abf7")}>
            <Input aria-label={t("settings.currentPassword33abf7")} type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} disabled={isChangingPassword} autoComplete="current-password" />
          </FormItem>
          <FormItem label={t("settings.newPasswordd22c9c")}>
            <Input aria-label={t("settings.newPasswordd22c9c")} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={isChangingPassword} autoComplete="new-password" />
          </FormItem>
          <FormItem label={t("settings.confirmNewPasswordd4477a")}>
            <Input aria-label={t("settings.confirmNewPasswordd4477a")} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isChangingPassword} autoComplete="new-password" />
          </FormItem>
          <div className="flex flex-wrap items-center gap-3">
            <Button loading={isChangingPassword} loadingLabel={t("settings.updating338df3")} variant="secondary" leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => void handleChangePassword()} disabled={isChangingPassword}>
              {t("settings.changePassword0ae20a")}</Button>
            {passwordMessage && <span role="status" className="text-sm text-success-fg">{passwordMessage}</span>}
            {passwordError && <span role="alert" className="text-sm text-danger-fg">{passwordError}</span>}
          </div>
        </div>
      </section>

      <section className="yj-panel p-5 lg:col-span-2">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-fg" />
          <div>
            <h3 className="text-base font-medium text-danger-fg">{t("settings.deleteAccount925984")}</h3>
            <p className="mt-1 text-sm leading-6 text-fg-muted">{t(isSaaS ? 'settings.accountDeletionMayInvolveUnusedCreditRefundsb290c0' : 'settings.deploymentAccountDeletion')}</p>
          </div>
        </div>
        {isSaaS && <SupportDialog trigger="button" context="account" />}
      </section>

    </div>
  );
}

function ReadOnlyField({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return <div className="min-w-0">
    <div className="mb-2 text-sm text-fg-muted">{label}</div>
    <div className={`min-h-10 flex items-center break-all text-sm text-fg-default ${mono ? 'font-mono text-xs' : ''}`}>{children}</div>
  </div>;
}
