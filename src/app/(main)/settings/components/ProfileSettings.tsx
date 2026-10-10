'use client';

import * as React from 'react';
import { Button, FormItem, Input, Tag } from '@schema/ui-kit';
import { AlertTriangle, Bot, Building2, KeyRound, Loader2, Save, UserRound } from 'lucide-react';
import { SupportDialog } from '@/components/support/SupportDialog';
import { AISettingsPanel } from '@/components/shared/AISettingsPanel';
import { useAI } from '@/components/providers/AIProvider';
import type { User, UserOrganizationInfo } from '@/types/user';

interface ProfileSettingsProps {
  user: User;
  currentOrg: UserOrganizationInfo | null;
  onUpdateProfile: (data: { name: string }) => Promise<User>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<void>;
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

export function ProfileSettings({ user, currentOrg, onUpdateProfile, onChangePassword }: ProfileSettingsProps) {
  const { config, setConfig } = useAI();
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
  const handleChangePassword = async () => {
    setPasswordMessage(null);
    setPasswordError(null);
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写完整的密码信息');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('新密码至少需要 8 个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }
    setIsChangingPassword(true);
    try {
      await onChangePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('密码已更新，其他登录会话已失效');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setIsChangingPassword(false);
    }
  };
  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="yj-panel p-5 lg:col-span-2">
        <div className="mb-5 flex items-center gap-2">
          <UserRound className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">账号信息</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
          <FormItem label="姓名" className="col-span-2 md:col-span-1">
            <Input aria-label="姓名" value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving} />
          </FormItem>
          <ReadOnlyField label="邮箱">{user.email}</ReadOnlyField>
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
          <ReadOnlyField label="注册审批">{user.approvalStatus === 'approved' ? '已通过' : user.approvalStatus === 'pending' ? '待审批' : user.approvalStatus === 'rejected' ? '未通过' : '—'}</ReadOnlyField>
          <ReadOnlyField label="创建时间">{formatTime(user.createdAt)}</ReadOnlyField>
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
          {message && <span role="status" className="text-sm text-success-fg">{message}</span>}
          {error && <span role="alert" className="text-sm text-danger-fg">{error}</span>}
        </div>
      </section>

      <section className="yj-panel p-5">
        <div className="mb-5 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">当前机构</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadOnlyField label="机构名称">{currentOrg?.name ?? '—'}</ReadOnlyField>
          <ReadOnlyField label="机构编号" mono>{currentOrg?.id ?? '—'}</ReadOnlyField>
        </div>
      </section>

      <AISettingsPanel admin={user.systemRole === 'PLATFORM_ADMIN'} />

      <section className="yj-panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">页面助手</h3>
            <p className="mt-1 text-xs text-fg-muted">开启后将读取当前页面内容并发送至平台 AI 服务。请勿在含患者信息的页面启用。</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-default">
          <input
            type="checkbox"
            checked={config.aiAssistantEnabled}
            onChange={(event) => setConfig({ aiAssistantEnabled: event.target.checked })}
          />
          启用页面 AI 助手
        </label>
      </section>

      <section className="yj-panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent-fg" />
          <div>
            <h3 className="text-base font-medium text-fg-default">账号安全</h3>
            <p className="mt-1 text-xs text-fg-muted">使用当前密码验证后设置新密码。</p>
          </div>
        </div>
        <div className="grid max-w-md grid-cols-1 gap-3">
          <FormItem label="当前密码">
            <Input aria-label="当前密码" type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} disabled={isChangingPassword} autoComplete="current-password" />
          </FormItem>
          <FormItem label="新密码">
            <Input aria-label="新密码" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={isChangingPassword} autoComplete="new-password" />
          </FormItem>
          <FormItem label="确认新密码">
            <Input aria-label="确认新密码" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isChangingPassword} autoComplete="new-password" />
          </FormItem>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => void handleChangePassword()} disabled={isChangingPassword}>
              {isChangingPassword ? '更新中...' : '修改密码'}
            </Button>
            {passwordMessage && <span role="status" className="text-sm text-success-fg">{passwordMessage}</span>}
            {passwordError && <span role="alert" className="text-sm text-danger-fg">{passwordError}</span>}
          </div>
        </div>
      </section>

      <section className="yj-panel p-5 lg:col-span-2">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-fg" />
          <div>
            <h3 className="text-base font-medium text-danger-fg">删除账户</h3>
            <p className="mt-1 text-sm leading-6 text-fg-muted">账户注销可能涉及剩余积分退费，现阶段需由工作人员核对账户、所属机构及积分余额后处理。</p>
          </div>
        </div>
        <SupportDialog trigger="button" context="account" />
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
