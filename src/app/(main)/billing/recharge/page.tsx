'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Tag } from '@schema/ui-kit';
import { ArrowLeft, Check, Clock3, Coins, Copy, CreditCard } from 'lucide-react';
import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { calculateEstimatedCredits, getBillingBalance, getBillingConfig, type BillingBalance, type BillingConfig } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

const PRESET_CREDITS = [100, 500, 1000, 5000];

export default function RechargePage() {
  const router = useRouter();
  const { user, currentOrg } = useAuth();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [balance, setBalance] = React.useState<BillingBalance | null>(null);
  const [config, setConfig] = React.useState<BillingConfig | null>(null);
  const [amount, setAmount] = React.useState(500);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!isSaaS) {
      router.replace('/dashboard');
      return;
    }
    Promise.all([getBillingBalance(), getBillingConfig()])
      .then(([nextBalance, nextConfig]) => {
        setBalance(nextBalance);
        setConfig(nextConfig);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载充值信息失败'));
  }, [isSaaS, router]);

  const estimatedMinutes = config
    ? Math.floor(amount / (config.credits_per_minute * config.credit_rate_multiplier))
    : null;
  const exampleTaskCost = calculateEstimatedCredits(60, config);

  const copyRequest = async () => {
    const request = [
      'SchemaBio SaaS 积分充值申请',
      `机构：${currentOrg?.name ?? '-'} (${currentOrg?.id ?? '-'})`,
      `账号：${user?.email ?? '-'}`,
      `申请积分：${amount}`,
      `当前余额：${balance?.balance ?? '-'}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(request);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('无法复制充值申请，请检查浏览器剪贴板权限');
    }
  };

  if (!isSaaS) return null;

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <Link href="/billing" className="mb-2 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg-default">
            <ArrowLeft className="h-4 w-4" />
            返回费用中心
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="yj-page-title">充值</h2>
            <Tag variant="warning">人工审核</Tag>
          </div>
          <p className="yj-page-subtitle">选择积分数量并生成充值申请，平台确认后余额会显示在费用中心。</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="yj-panel p-5">
          <div className="mb-5 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent-fg" />
            <h3 className="text-base font-medium text-fg-default">充值积分</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESET_CREDITS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                  amount === preset
                    ? 'border-accent-emphasis bg-accent-subtle text-accent-fg'
                    : 'border-border-default bg-canvas-default text-fg-default hover:bg-canvas-subtle'
                }`}
              >
                {preset} 积分
              </button>
            ))}
          </div>

          <div className="mt-5 max-w-xs">
            <label className="mb-2 block text-sm font-medium text-fg-default">自定义数量</label>
            <Input
              type="number"
              min="1"
              step="100"
              value={amount}
              onChange={(event) => setAmount(Math.max(1, Math.trunc(Number(event.target.value)) || 1))}
            />
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-border-default pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-fg-muted">申请数量</p>
              <p className="text-2xl font-semibold text-fg-default">{amount} 积分</p>
            </div>
            <Button
              variant="primary"
              className="w-full min-w-[168px] justify-center sm:w-auto"
              leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              onClick={() => void copyRequest()}
            >
              {copied ? '已复制' : '复制充值申请'}
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="yj-panel p-4">
            <div className="flex items-center gap-2 text-fg-muted">
              <Coins className="h-4 w-4" />
              <span className="text-sm">当前余额</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-fg-default">{balance?.balance ?? '--'} 积分</p>
          </div>
          <div className="yj-panel p-4">
            <div className="flex items-center gap-2 text-fg-muted">
              <Clock3 className="h-4 w-4" />
              <span className="text-sm">本次充值可运行</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-fg-default">约 {estimatedMinutes ?? '--'} 分钟</p>
            <p className="mt-2 text-xs text-fg-muted">默认 60 分钟任务预计扣费 {exampleTaskCost ?? '--'} 积分</p>
          </div>
          <div className="yj-panel p-4 text-sm text-fg-muted">
            <p className="font-medium text-fg-default">入账方式</p>
            <p className="mt-2">平台运营确认申请后，通过 Squid 管理端完成入账。费用中心会显示充值流水和最新余额。</p>
          </div>
        </aside>
      </div>
    </PageContent>
  );
}
