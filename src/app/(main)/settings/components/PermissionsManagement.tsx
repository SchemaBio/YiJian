'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, translateUI, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';

import { AppModal, EmptyState } from '@/components/shared';
import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { Input, Select, FormItem, DataTable, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { CheckCircle2, Loader2, Search, Shield, Trash2, Users, XCircle } from 'lucide-react';
import type { SystemRole, User } from '@/types/user';
import { approveUser, deleteUser, listPendingUsers, listUsers, rejectUser, updateUser } from '@/lib/users';

const SYSTEM_ROLES: Array<{ id: SystemRole; name: string; description: string }> = [
  { id: 'PLATFORM_ADMIN', name: '平台管理员', description: '自部署环境的管理员，可创建子用户并分配系统角色' },
  { id: 'ORG_USER', name: '机构用户', description: '自部署环境的子用户，按管理员授予的角色使用业务功能' },
];

const roleVariant: Record<SystemRole, 'warning' | 'info'> = {
  PLATFORM_ADMIN: 'warning',
  ORG_USER: 'info',
};

function roleName(role: SystemRole): string {
  return SYSTEM_ROLES.find((item) => item.id === role)?.name ?? role;
}

function formatTime(value: string, t: TextTranslator = chineseText): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(t.locale, { hour12: false });
}

export function PermissionsManagement() {
  const t = useText();
  const [users, setUsers] = React.useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = React.useState<User[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [moderatingUserId, setModeratingUserId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const [userForm, setUserForm] = React.useState({
    name: '',
    systemRole: 'ORG_USER' as SystemRole,
    isActive: true,
  });

  const loadUsers = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [result, pending] = await Promise.all([
        listUsers({ page: 1, pageSize: 100, search: searchQuery.trim() || undefined }),
        listPendingUsers(),
      ]);
      setUsers(result.items);
      setPendingUsers(pending);
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("settings.unableToLoadUsers24ee20"));
      setUsers([]);
      setPendingUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, t]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const openEditModal = (user: User) => {
    setError(null);
    setEditingUser(user);
    setUserForm({
      name: user.name,
      systemRole: user.systemRole,
      isActive: user.isActive,
    });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (!userForm.name.trim()) {
      setError(t("settings.enterAName71883c"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateUser(editingUser.id, {
        name: userForm.name.trim(),
        systemRole: userForm.systemRole,
        isActive: userForm.isActive,
      });
      setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("settings.unableToSaveUserb23480"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((user) => user.id !== userToDelete.id));
      setUserToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("settings.unableToDeleteUser81d451"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleModerateUser = async (user: User, decision: 'approve' | 'reject') => {
    setModeratingUserId(user.id);
    setError(null);
    try {
      if (decision === 'approve') {
        await approveUser(user.id);
      } else {
        await rejectUser(user.id);
      }
      setPendingUsers((prev) => prev.filter((item) => item.id !== user.id));
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : decision === 'approve' ? t("settings.unableToApproveUser7d237e") : t("settings.unableToRejectUser8fd60f"));
    } finally {
      setModeratingUserId(null);
    }
  };

  const columns: Column<User>[] = [
    { id: 'name', header: t("samples.namebe4c26"), accessor: 'name', width: 120, align: 'center' },
    { id: 'email', header: t("settings.email9ed627"), accessor: 'email', width: 220, align: 'center' },
    {
      id: 'systemRole',
      header: t("settings.systemRole97946d"),
      accessor: (row) => <Tag variant={roleVariant[row.systemRole]}>{roleName(row.systemRole)}</Tag>,
      width: 130,
      align: 'center',
    },
    { id: 'orgId', header: t("settings.organizationIdbb939b"), accessor: (row) => row.orgId || '-', width: 180, align: 'center' },
    {
      id: 'status',
      header: t("admin.status62e951"),
      accessor: (row) => (
        <Tag variant={row.isActive ? 'success' : 'neutral'}>{row.isActive ? t("admin.enabledd4e9ca") : t("admin.disabledd989e5")}</Tag>
      ),
      width: 90,
      align: 'center',
    },
    {
      id: 'approvalStatus',
      header: t("settings.approvalStatus936237"),
      accessor: (row) => row.approvalStatus === 'approved' ? t("settings.approved4b3c96") : row.approvalStatus === 'pending' ? t("settings.awaitingApproval57fce0") : row.approvalStatus === 'rejected' ? t("settings.rejected349c9e") : '—',
      width: 100,
      align: 'center',
    },
    {
      id: 'createdAt',
      header: t("admin.createdAt84e380"),
      accessor: (row) => formatTime(row.createdAt, t),
      width: 180,
      align: 'center',
    },
    {
      id: 'actions',
      header: t("admin.actionsf3ea6d"),
      accessor: (row) => (
        <div className="flex items-center justify-center gap-1">
          <HoverHint content={t("admin.edita7f814")}><ActionButton size="small" iconOnly action="edit" variant="ghost"
            className="p-1.5 rounded hover:bg-canvas-subtle text-fg-muted hover:text-accent-fg transition-colors"

            onClick={() => openEditModal(row)}
           /></HoverHint>
          <HoverHint content={t("data.delete3755f5")}><ActionButton size="small" iconOnly action="delete" variant="ghost"
            className="p-1.5 rounded hover:bg-danger-subtle text-fg-muted hover:text-danger-fg transition-colors"

            onClick={() => setUserToDelete(row)}
           /></HoverHint>
        </div>
      ),
      width: 90,
      align: 'center',
    },
  ];

  return (
    <div className="space-y-6">


      {pendingUsers.length > 0 && (
        <div className="yj-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-fg-default">{t("settings.registrationsAwaitingApproval4070f5")}</h3>
              <p className="mt-1 text-xs text-fg-muted">{t("settings.reviewAndManageNewUserAccountsaa8cfd")}</p>
            </div>
            <Tag variant="warning">{pendingUsers.length} {t("settings.awaitingApproval476a6c")}</Tag>
          </div>
          <div className="divide-y divide-border-default">
            {pendingUsers.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg-default">{user.name || user.email}</div>
                  <div className="truncate text-xs text-fg-muted">
                    {user.email} {t("settings.organization54ec4b")}{user.orgId || '-'} · {formatTime(user.createdAt, t)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    leftIcon={<XCircle className="h-4 w-4" />}
                    onClick={() => void handleModerateUser(user, 'reject')}
                    disabled={moderatingUserId === user.id}
                  >
                    {t("settings.reject03e210")}</Button>
                  <Button
                    variant="primary"
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => void handleModerateUser(user, 'approve')}
                    disabled={moderatingUserId === user.id}
                  >
                    {t("settings.approvedcc423")}</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="yj-toolbar-panel">
        <div className="w-full sm:w-72">
          <Input
            placeholder={t("settings.searchNameEmailOrOrganizationIdbfe305")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button action="refresh" variant="secondary" className="yj-tool-button"  onClick={() => void loadUsers()} disabled={isLoading}>
          {t("admin.refresh38108e")}</Button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="yj-empty-state">
          <Loader2 className="w-6 h-6 animate-spin text-accent-fg" />
          <p className="text-fg-muted">{t("settings.loadingUsers31fb0d")}</p>
        </div>
      ) : error && users.length === 0 ? null : users.length === 0 ? (
        <EmptyState className="yj-panel" icon={<Users />} title={searchQuery.trim() ? t("settings.noMatchingUsersc766ea") : t("settings.noUsers3d268b")} description={searchQuery.trim() ? t("pipeline.adjustYourSearchAndRetryf591c7") : undefined} />
      ) : (
        <div className="[&_table]:min-w-[1110px]"><DataTable data={users} columns={localizeDisplay(columns, t)} rowKey="id" density="default" striped /></div>
      )}

      <div className="yj-panel overflow-hidden">
        <div className="yj-panel-header"><h3 className="yj-section-title">{t("settings.systemRole97946d")}</h3></div>
        <div className="grid grid-cols-1 divide-y divide-[var(--yj-border-subtle)] md:grid-cols-2 md:divide-x md:divide-y-0">
          {SYSTEM_ROLES.map((role) => (
            <div key={role.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-accent-fg" />
                <h4 className="text-sm font-medium text-fg-default">{role.name}</h4>
              </div>
              <p className="text-xs text-fg-muted">{translateUI(role.description, t)}</p>
            </div>
          ))}
        </div>
      </div>

      <AppModal open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)} size="medium" title={t("settings.editUser2b8f00")} footer={<>
          <Button variant="secondary" onClick={() => setEditingUser(null)} disabled={isSaving}>
            {t("admin.cancel4d0b46")}</Button>
          <Button loading={isSaving} loadingLabel={t("admin.savingd70d42")} action="save" variant="primary" onClick={handleSaveUser} disabled={isSaving}>
            {t("data.savefadf24")}</Button>
         </>}>
          <div className="space-y-4">
            {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
            <FormItem label={t("settings.email9ed627")}>
              <div className="break-all text-sm text-fg-default">{editingUser?.email ?? '—'}</div>
            </FormItem>
            <FormItem label={t("samples.namebe4c26")} required>
              <Input
                aria-label={t("samples.namebe4c26")}
                value={userForm.name}
                onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t("samples.enterName675b3e")}
              />
            </FormItem>
            <FormItem label={t("settings.systemRole97946d")} required>
              <Select
                options={localizeDisplay(SYSTEM_ROLES.map((role) => ({ value: role.id, label: role.name })), t)}
                value={userForm.systemRole}
                onChange={(value) => {
                  const nextRole = Array.isArray(value) ? value[0] : value;
                  setUserForm((prev) => ({ ...prev, systemRole: nextRole as SystemRole }));
                }}
              />
            </FormItem>
            <FormItem label={t("settings.accountStatus67104f")} required>
              <Select
                options={[
                  { value: 'active', label: t("admin.enabledd4e9ca") },
                  { value: 'inactive', label: t("admin.disabledd989e5") },
                ]}
                value={userForm.isActive ? 'active' : 'inactive'}
                onChange={(value) => {
                  const nextStatus = Array.isArray(value) ? value[0] : value;
                  setUserForm((prev) => ({ ...prev, isActive: nextStatus === 'active' }));
                }}
              />
            </FormItem>
          </div>
         </AppModal>

      <AppModal open={Boolean(userToDelete)} onOpenChange={(open) => !open && setUserToDelete(null)} size="small" title={t("data.confirmDeletion3c06ab")} footer={<>
          <Button variant="secondary" onClick={() => setUserToDelete(null)} disabled={isSaving}>
            {t("admin.cancel4d0b46")}</Button>
          <Button loading={isSaving} loadingLabel={t("settings.deleting6f941d")} variant="danger" onClick={handleDeleteUser} disabled={isSaving}>
            {t("data.delete3755f5")}</Button>
         </>}>
          {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-danger-subtle flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-danger-fg" />
            </div>
            <p className="text-fg-default mb-2">{t("settings.deleteThisUser332e3a")}</p>
            {userToDelete && (
              <p className="text-sm text-fg-muted">
                {userToDelete.name}（{userToDelete.email}）
              </p>
            )}
            <p className="text-xs text-fg-muted mt-3">{t("settings.thisAccountWillNoLongerBeAble5b44aa")}</p>
          </div>
         </AppModal>
    </div>
  );
}
