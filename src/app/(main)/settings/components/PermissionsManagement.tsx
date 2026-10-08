'use client';
import { AppModal, EmptyState } from '@/components/shared';
import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { Button, Input, Select, FormItem, DataTable, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { CheckCircle2, Loader2, Pencil, Search, Shield, Trash2, Users, XCircle } from 'lucide-react';
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

function formatTime(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function PermissionsManagement() {
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
      setError(err instanceof Error ? err.message : '加载用户列表失败');
      setUsers([]);
      setPendingUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

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
      setError('请填写姓名');
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
      setError(err instanceof Error ? err.message : '保存用户失败');
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
      setError(err instanceof Error ? err.message : '删除用户失败');
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
      setError(err instanceof Error ? err.message : decision === 'approve' ? '审批用户失败' : '拒绝用户失败');
    } finally {
      setModeratingUserId(null);
    }
  };

  const columns: Column<User>[] = [
    { id: 'name', header: '姓名', accessor: 'name', width: 120, align: 'center' },
    { id: 'email', header: '邮箱', accessor: 'email', width: 220, align: 'center' },
    {
      id: 'systemRole',
      header: '系统角色',
      accessor: (row) => <Tag variant={roleVariant[row.systemRole]}>{roleName(row.systemRole)}</Tag>,
      width: 130,
      align: 'center',
    },
    { id: 'orgId', header: '机构 ID', accessor: (row) => row.orgId || '-', width: 180, align: 'center' },
    {
      id: 'status',
      header: '状态',
      accessor: (row) => (
        <Tag variant={row.isActive ? 'success' : 'neutral'}>{row.isActive ? '启用' : '停用'}</Tag>
      ),
      width: 90,
      align: 'center',
    },
    {
      id: 'approvalStatus',
      header: '审批状态',
      accessor: (row) => row.approvalStatus === 'approved' ? '已通过' : row.approvalStatus === 'pending' ? '待审批' : row.approvalStatus === 'rejected' ? '未通过' : '—',
      width: 100,
      align: 'center',
    },
    {
      id: 'createdAt',
      header: '创建时间',
      accessor: (row) => formatTime(row.createdAt),
      width: 180,
      align: 'center',
    },
    {
      id: 'actions',
      header: '操作',
      accessor: (row) => (
        <div className="flex items-center justify-center gap-1">
          <HoverHint content="编辑"><button
            className="p-1.5 rounded hover:bg-canvas-subtle text-fg-muted hover:text-accent-fg transition-colors"

            onClick={() => openEditModal(row)}
          >
            <Pencil className="w-4 h-4" />
          </button></HoverHint>
          <HoverHint content="删除"><button
            className="p-1.5 rounded hover:bg-danger-subtle text-fg-muted hover:text-danger-fg transition-colors"

            onClick={() => setUserToDelete(row)}
          >
            <Trash2 className="w-4 h-4" />
          </button></HoverHint>
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
              <h3 className="text-sm font-medium text-fg-default">待审批注册</h3>
              <p className="mt-1 text-xs text-fg-muted">审核并管理新建的子用户账号。</p>
            </div>
            <Tag variant="warning">{pendingUsers.length} 待审批</Tag>
          </div>
          <div className="divide-y divide-border-default">
            {pendingUsers.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg-default">{user.name || user.email}</div>
                  <div className="truncate text-xs text-fg-muted">
                    {user.email} · 机构 {user.orgId || '-'} · {formatTime(user.createdAt)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    leftIcon={<XCircle className="h-4 w-4" />}
                    onClick={() => void handleModerateUser(user, 'reject')}
                    disabled={moderatingUserId === user.id}
                  >
                    拒绝
                  </Button>
                  <Button
                    variant="primary"
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => void handleModerateUser(user, 'approve')}
                    disabled={moderatingUserId === user.id}
                  >
                    通过
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="yj-toolbar-panel">
        <div className="w-full sm:w-72">
          <Input
            placeholder="搜索姓名、邮箱或机构 ID..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button variant="secondary" className="yj-tool-button" leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} onClick={() => void loadUsers()} disabled={isLoading}>
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="yj-empty-state">
          <Loader2 className="w-6 h-6 animate-spin text-accent-fg" />
          <p className="text-fg-muted">正在加载用户列表...</p>
        </div>
      ) : users.length === 0 ? (
        <EmptyState className="yj-panel" icon={<Users />} title={searchQuery.trim() ? '没有匹配的用户' : '暂无用户'} description={searchQuery.trim() ? '调整搜索条件后重试。' : undefined} />
      ) : (
        <div className="[&_table]:min-w-[1110px]"><DataTable data={users} columns={columns} rowKey="id" density="default" striped /></div>
      )}

      <div className="yj-panel overflow-hidden">
        <div className="yj-panel-header"><h3 className="yj-section-title">系统角色</h3></div>
        <div className="grid grid-cols-1 divide-y divide-[var(--yj-border-subtle)] md:grid-cols-2 md:divide-x md:divide-y-0">
          {SYSTEM_ROLES.map((role) => (
            <div key={role.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-accent-fg" />
                <h4 className="text-sm font-medium text-fg-default">{role.name}</h4>
              </div>
              <p className="text-xs text-fg-muted">{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      <AppModal open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)} size="medium" title="编辑用户" footer={<>
          <Button variant="secondary" onClick={() => setEditingUser(null)} disabled={isSaving}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSaveUser} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
         </>}>
          <div className="space-y-4">
            {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
            <FormItem label="邮箱">
              <div className="break-all text-sm text-fg-default">{editingUser?.email ?? '—'}</div>
            </FormItem>
            <FormItem label="姓名" required>
              <Input
                aria-label="姓名"
                value={userForm.name}
                onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="请输入姓名"
              />
            </FormItem>
            <FormItem label="系统角色" required>
              <Select
                options={SYSTEM_ROLES.map((role) => ({ value: role.id, label: role.name }))}
                value={userForm.systemRole}
                onChange={(value) => {
                  const nextRole = Array.isArray(value) ? value[0] : value;
                  setUserForm((prev) => ({ ...prev, systemRole: nextRole as SystemRole }));
                }}
              />
            </FormItem>
            <FormItem label="账号状态" required>
              <Select
                options={[
                  { value: 'active', label: '启用' },
                  { value: 'inactive', label: '停用' },
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

      <AppModal open={Boolean(userToDelete)} onOpenChange={(open) => !open && setUserToDelete(null)} size="small" title="确认删除" footer={<>
          <Button variant="secondary" onClick={() => setUserToDelete(null)} disabled={isSaving}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDeleteUser} disabled={isSaving}>
            {isSaving ? '删除中...' : '删除'}
          </Button>
         </>}>
          {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-danger-subtle flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-danger-fg" />
            </div>
            <p className="text-fg-default mb-2">确定要删除此用户吗？</p>
            {userToDelete && (
              <p className="text-sm text-fg-muted">
                {userToDelete.name}（{userToDelete.email}）
              </p>
            )}
            <p className="text-xs text-fg-muted mt-3">删除后该账号将无法登录，此操作不可撤销。</p>
          </div>
         </AppModal>
    </div>
  );
}
