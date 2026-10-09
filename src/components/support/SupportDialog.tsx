'use client';
import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { Button } from '@schema/ui-kit';
import { Check, Clipboard, LifeBuoy, Mail, UserRoundX } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeSupportEmail } from '@/lib/runtime-config';

interface SupportDialogProps {
  trigger?: 'icon' | 'button';
  context?: 'general' | 'billing' | 'account';
}

export function SupportDialog({ trigger = 'icon', context = 'general' }: SupportDialogProps) {
  const { user, currentOrg } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState('');
  const supportEmail = getRuntimeSupportEmail();

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopied(true);
      setCopyError('');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('无法复制，请手动选择邮箱地址');
    }
  };

  const openDialog = () => {
    setCopied(false);
    setCopyError('');
    setOpen(true);
  };

  return <>
    {trigger === 'icon' ? (
      <HoverHint content="帮助与支持"><button
        type="button"
        onClick={openDialog}
        className="p-2 rounded-md text-fg-muted hover:text-fg-default hover:bg-[var(--yj-panel-muted)] transition-colors"
        aria-label="帮助与支持"

      >
        <LifeBuoy className="h-5 w-5" />
      </button></HoverHint>
    ) : (
      <Button
        variant="secondary"
        leftIcon={context === 'account' ? <UserRoundX className="h-4 w-4" /> : <LifeBuoy className="h-4 w-4" />}
        onClick={openDialog}
      >
        {context === 'account' ? '联系支持申请删除账户' : '查看联系方式'}
      </Button>
    )}

    <AppModal
      open={open}
      onOpenChange={setOpen}
      title="帮助与支持"
      size="medium"
      footer={<><Button variant="secondary" onClick={() => setOpen(false)}>关闭</Button><Button variant="primary" leftIcon={copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />} onClick={() => void copyEmail()}>{copied ? '已复制邮箱' : '复制邮箱'}</Button></>}
    >
      <div className="space-y-5">
        {context === 'account' && <ModalSectionHeading icon={<UserRoundX className="h-4 w-4" />} title="申请删除账户" />}
        <p className="text-sm leading-6 text-fg-muted">积分、计费、任务分析、数据与流程问题，请通过支持邮箱联系我们。</p>

        <div className="rounded-md border border-warning-muted bg-warning-subtle px-4 py-3">
          <div className="flex items-start gap-3">
            <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" />
            <div>
              <p className="text-sm font-medium text-warning-fg">账户注销与余额退费</p>
              <p className="mt-1 text-xs leading-5 text-fg-muted">账户注销可能涉及剩余积分退费，现阶段需由工作人员核对账户、所属机构及积分余额后处理。请使用下方支持邮箱提交申请。</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-accent-muted bg-accent-subtle px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg-muted"><Mail className="h-4 w-4" />支持邮箱</div>
          <button type="button" onClick={() => void copyEmail()} className="mt-1 break-all text-left text-base font-semibold text-accent-fg hover:underline">{supportEmail}</button>
          {copyError && <p role="alert" className="mt-1 text-xs text-danger-fg">{copyError}</p>}
        </div>

        <div>
          <p className="text-sm font-medium text-fg-default">联系时建议提供</p>
          <ul className="mt-2 space-y-1.5 break-words text-xs leading-5 text-fg-muted">
            <li>• 当前组织：{currentOrg?.name ?? '-'}（{currentOrg?.id ?? '-'}）</li>
            <li>• 当前账号：{user?.email ?? '-'}</li>
            <li>• 问题发生时间、现象和期望处理方式</li>
            <li>• 相关任务、交易、样本或数据 UUID，以及必要的错误截图</li>
          </ul>
        </div>
      </div>
    </AppModal>
  </>;
}
