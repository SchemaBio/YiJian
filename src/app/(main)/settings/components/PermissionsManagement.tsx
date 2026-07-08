'use client';

import * as React from 'react';
import { Button, Input, Select, FormItem, Modal, ModalHeader, ModalBody, ModalFooter, DataTable, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { CheckCircle2, Loader2, Pencil, Search, Shield, Trash2, Users, XCircle } from 'lucide-react';
import type { SystemRole, User } from '@/types/user';
import { approveUser, deleteUser, listPendingUsers, listUsers, rejectUser, updateUser } from '@/lib/users';

const SYSTEM_ROLES: Array<{ id: SystemRole; name: string; description: string }> = [
  { id: 'PLATFORM_ADMIN', name: '平台管理员', description: '可管理租户、用户、计费与系统级配置' },
  { id: 'ORG_USER', name: '机构用户', description: '机构内普通 SaaS 账号，具体业务权限由后端策略控制' },
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
      setError(err instanceof Error ? err.message : `Failed to ${decision} user`);
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
      accessor: (row) => row.approvalStatus ?? '-',
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
          <button
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-blue-600 transition-colors"
            title="编辑"
            onClick={() => openEditModal(row)}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-600 transition-colors"
            title="删除"
            onClick={() => setUserToDelete(row)}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      width: 90,
      align: 'center',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="yj-info-panel">
        <h3 className="text-sm font-medium text-fg-default mb-3">权限模型说明</h3>
        <div className="grid grid-cols-2 gap-4">
          {SYSTEM_ROLES.map((role) => (
            <div key={role.id} className="yj-panel p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-accent-fg" />
                <h4 className="text-sm font-medium text-fg-default">{role.name}</h4>
              </div>
              <p className="text-xs text-fg-muted">{role.description}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-fg-muted mt-3">
          当前页面已对齐 Squid 的 `/api/v1/users` 平台管理员接口；SaaS 账号仍按“机构开通/注册审批”流转，不在前端伪造额外权限或本地新增账号状态。
        </p>
      </div>

      {pendingUsers.length > 0 && (
        <div className="yj-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-fg-default">待审批注册</h3>
              <p className="mt-1 text-xs text-fg-muted">
                数据来自 Squid `GET /api/v1/users/pending`，审批操作会调用真实后端接口。
              </p>
            </div>
            <Tag variant="warning">{pendingUsers.length} pending</Tag>
          </div>
          <div className="divide-y divide-border-default">
            {pendingUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg-default">{user.name || user.email}</div>
                  <div className="truncate text-xs text-fg-muted">
                    {user.email} · org {user.orgId || '-'} · {formatTime(user.createdAt)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void handleModerateUser(user, 'reject')}
                    disabled={moderatingUserId === user.id}
                  >
                    <XCircle className="h-4 w-4" />
                    拒绝
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void handleModerateUser(user, 'approve')}
                    disabled={moderatingUserId === user.id}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    通过
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="yj-toolbar-panel">
        <div className="w-72">
          <Input
            placeholder="搜索姓名、邮箱或机构 ID..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button variant="secondary" onClick={() => void loadUsers()} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
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
      ) : (
        <DataTable data={users} columns={columns} rowKey="id" density="default" striped />
      )}

      <Modal open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)} size="medium">
        <ModalHeader>编辑用户</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <FormItem label="邮箱">
              <Input value={editingUser?.email ?? ''} disabled />
            </FormItem>
            <FormItem label="姓名" required>
              <Input
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
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setEditingUser(null)} disabled={isSaving}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSaveUser} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={Boolean(userToDelete)} onOpenChange={(open) => !open && setUserToDelete(null)} size="small">
        <ModalHeader>确认删除</ModalHeader>
        <ModalBody>
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
            <p className="text-xs text-fg-muted mt-3">该操作会调用 Squid `DELETE /api/v1/users/:id`，不可撤销。</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setUserToDelete(null)} disabled={isSaving}>
            取消
          </Button>
          <Button variant="danger" onClick={handleDeleteUser} disabled={isSaving}>
            {isSaving ? '删除中...' : '删除'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
