'use client';

import * as React from 'react';
import { Button } from '@schema/ui-kit';
import { Check, CircleDollarSign, Clipboard, Database, LifeBuoy, Mail, Workflow } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeSupportEmail } from '@/lib/runtime-config';

interface SupportDialogProps {
  trigger?: 'icon' | 'button';
  context?: 'general' | 'billing';
}

const supportTypes = [
  { title: '积分与退款', description: '积分退款、充值入账、扣费核对与流水疑问', icon: CircleDollarSign },
  { title: '任务与分析', description: '任务失败、结果异常、运行时间或分析问题', icon: Workflow },
  { title: '数据与流程', description: '数据上传、样本匹配、BED、CNV 基线与自定义流程', icon: Database },
  { title: '其他技术咨询', description: '账户使用、功能建议以及其他平台技术问题', icon: LifeBuoy },
];

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
      <button
        type="button"
        onClick={openDialog}
        className="p-2 rounded-md text-fg-muted hover:text-fg-default hover:bg-[var(--yj-panel-muted)] transition-colors"
        aria-label="帮助与支持"
        title="帮助与支持"
      >
        <LifeBuoy className="h-5 w-5" />
      </button>
    ) : (
      <Button variant="secondary" leftIcon={<LifeBuoy className="h-4 w-4" />} onClick={openDialog}>
        查看联系方式
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
        <ModalSectionHeading
          icon={<LifeBuoy className="h-4 w-4" />}
          title={context === 'billing' ? '积分问题也可以联系我们' : '遇到问题可以联系我们'}
          description="平台暂不设置独立工单系统。无论是积分退款、计费核对还是技术咨询，都可以发送邮件联系我们。"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {supportTypes.map((item) => {
            const Icon = item.icon;
            return <div key={item.title} className="rounded-md border border-border-default bg-canvas-subtle p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-fg-default"><Icon className="h-4 w-4 text-accent-fg" />{item.title}</div>
              <p className="mt-1.5 text-xs leading-5 text-fg-muted">{item.description}</p>
            </div>;
          })}
        </div>

        <div className="rounded-md border border-accent-muted bg-accent-subtle px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg-muted"><Mail className="h-4 w-4" />支持邮箱</div>
          <button type="button" onClick={() => void copyEmail()} className="mt-1 break-all text-left text-base font-semibold text-accent-fg hover:underline">{supportEmail}</button>
          {copyError && <p className="mt-1 text-xs text-danger-fg">{copyError}</p>}
        </div>

        <div>
          <p className="text-sm font-medium text-fg-default">联系时建议提供</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-fg-muted">
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
