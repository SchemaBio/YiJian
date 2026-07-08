'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, FormItem, Input, Tag } from '@schema/ui-kit';
import { Loader2, Save, Shield, UserRound } from 'lucide-react';
import type { User, UserOrganizationInfo } from '@/types/user';

interface ProfileSettingsProps {
  user: User;
  currentOrg: UserOrganizationInfo | null;
  onUpdateProfile: (data: { name: string }) => Promise<User>;
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

export function ProfileSettings({ user, currentOrg, onUpdateProfile }: ProfileSettingsProps) {
  const [name, setName] = React.useState(user.name);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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

  return (
    <div className="yj-panel yj-form-card-wide space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-4">
          <UserRound className="w-5 h-5 text-accent-fg" />
          <h3 className="text-base font-medium text-fg-default">账号信息</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
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
        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" onClick={() => void handleSave()} disabled={!isDirty || isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存资料
          </Button>
          {message && <span className="text-sm text-success-fg">{message}</span>}
          {error && <span className="text-sm text-danger-fg">{error}</span>}
        </div>
        <p className="text-xs text-fg-muted mt-3">
          姓名修改会调用 Squid `PUT /api/v1/auth/me`，邮箱、角色和审批状态由后端权限策略控制。
        </p>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-accent-fg" />
          <h3 className="text-base font-medium text-fg-default">当前机构</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <FormItem label="机构名称">
            <Input value={currentOrg?.name ?? '-'} disabled />
          </FormItem>
          <FormItem label="机构标识">
            <Input value={currentOrg?.slug ?? '-'} disabled />
          </FormItem>
        </div>
        <p className="text-xs text-fg-muted mt-3">
          机构信息以 Squid `/api/v1/orgs/me` 为准；普通用户不能在前端伪造机构状态变更。
        </p>
      </section>

      <section className="pt-4 border-t border-[var(--yj-border-subtle)]">
        <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          密码找回已接入 Squid `/api/v1/auth/forgot-password` 与 `/api/v1/auth/reset-password`。
        </div>
        <Link href="/forgot-password">
          <Button variant="secondary">修改密码 / 找回密码</Button>
        </Link>
      </section>
    </div>
  );
}
