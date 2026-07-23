'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, FormItem, Input, Tag } from '@schema/ui-kit';
import { AppModal } from '@/components/shared';
import { AlertTriangle, Building2, KeyRound, Loader2, Save, Trash2, UserRound } from 'lucide-react';
import type { User, UserOrganizationInfo } from '@/types/user';

interface ProfileSettingsProps {
  user: User;
  currentOrg: UserOrganizationInfo | null;
  onUpdateProfile: (data: { name: string }) => Promise<User>;
  onDeleteAccount: (email: string) => Promise<void>;
}

function roleLabel(role: User['systemRole']): string {
  return role === 'PLATFORM_ADMIN' ? '平台管理员' : '机构用户';
}

function formatTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function ProfileSettings({ user, currentOrg, onUpdateProfile, onDeleteAccount }: ProfileSettingsProps) {
  const [name, setName] = React.useState(user.name);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteEmail, setDeleteEmail] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setName(user.name);
  }, [user.name]);

  const handleSave = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setError('姓名不能为空');
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onUpdateProfile({ name: nextName });
      setMessage('个人资料已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存个人资料失败');
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = name.trim() !== user.name;
  const isDeleteConfirmed = deleteEmail.trim().toLowerCase() === user.email.toLowerCase();

  const handleDelete = async () => {
    if (!isDeleteConfirmed || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteAccount(user.email);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除账户失败，请稍后重试');
      setIsDeleting(false);
    }
  };

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="yj-panel p-5 xl:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <UserRound className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">账号信息</h3>
            <p className="mt-1 text-xs text-fg-muted">维护登录名称和当前账号状态。</p>
          </div>
        </div>
        <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
          <FormItem label="姓名">
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving} />
          </FormItem>
          <FormItem label="邮箱">
            <Input type="email" value={user.email} disabled />
          </FormItem>
          <FormItem label="系统角色">
            <div className="h-10 flex items-center">
              <Tag variant={user.systemRole === 'PLATFORM_ADMIN' ? 'warning' : 'info'}>{roleLabel(user.systemRole)}</Tag>
            </div>
          </FormItem>
          <FormItem label="账号状态">
            <div className="h-10 flex items-center">
              <Tag variant={user.isActive ? 'success' : 'neutral'}>{user.isActive ? '启用' : '停用'}</Tag>
            </div>
          </FormItem>
          <FormItem label="注册审批">
            <Input value={user.approvalStatus ?? '-'} disabled />
          </FormItem>
          <FormItem label="创建时间">
            <Input value={formatTime(user.createdAt)} disabled />
          </FormItem>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--yj-border-subtle)] pt-4">
          <Button
            variant="primary"
            className="min-w-[124px] justify-center"
            leftIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            onClick={() => void handleSave()}
            disabled={!isDirty || isSaving}
          >
            保存资料
          </Button>
          {message && <span className="text-sm text-success-fg">{message}</span>}
          {error && <span className="text-sm text-danger-fg">{error}</span>}
        </div>
      </section>

      <section className="yj-panel p-5">
        <div className="mb-5 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">当前机构</h3>
            <p className="mt-1 text-xs text-fg-muted">当前会话所属的组织信息。</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <FormItem label="机构名称">
            <Input value={currentOrg?.name ?? '-'} disabled />
          </FormItem>
          <FormItem label="机构标识">
            <Input value={currentOrg?.slug ?? '-'} disabled />
          </FormItem>
        </div>
      </section>

      <section className="yj-panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">账号安全</h3>
            <p className="mt-1 text-xs text-fg-muted">通过验证邮箱完成密码重置。</p>
          </div>
        </div>
        <Link href="/forgot-password">
          <Button variant="secondary" leftIcon={<KeyRound className="h-4 w-4" />}>修改密码 / 找回密码</Button>
        </Link>
      </section>

      <section className="rounded-md border border-danger-muted bg-danger-subtle p-5 xl:col-span-2">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-fg" />
          <div>
            <h3 className="text-base font-medium text-danger-fg">删除账户</h3>
            <p className="mt-1 text-sm leading-6 text-fg-muted">删除后将立即退出登录且无法恢复。组织数据将按当前部署的数据保留策略处理。</p>
          </div>
        </div>
        {user.systemRole === 'PLATFORM_ADMIN' ? (
          <p className="text-xs text-fg-muted">平台管理员账号不能在此处删除，请通过部署管理流程处理。</p>
        ) : (
          <Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => { setDeleteEmail(''); setDeleteError(null); setDeleteOpen(true); }}>
            删除我的账户
          </Button>
        )}
      </section>

      <AppModal
        open={deleteOpen}
        onOpenChange={(open) => { if (!isDeleting) setDeleteOpen(open); }}
        title="确认删除账户"
        size="small"
        closeOnOverlayClick={!isDeleting}
        closeOnEscape={!isDeleting}
        footer={
          <>
            <Button variant="secondary" disabled={isDeleting} onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button
              variant="danger"
              leftIcon={isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              disabled={!isDeleteConfirmed || isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? '正在删除...' : '确认删除'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-fg-default">此操作不可撤销。请输入当前登录邮箱 <strong>{user.email}</strong> 以确认。</p>
          <Input
            value={deleteEmail}
            onChange={(event) => setDeleteEmail(event.target.value)}
            placeholder="输入当前登录邮箱"
            type="email"
            disabled={isDeleting}
            autoComplete="off"
          />
          {deleteError && <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{deleteError}</div>}
        </div>
      </AppModal>
    </div>
  );
}
