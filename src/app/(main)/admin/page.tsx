'use client';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import { Button, DataTable, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { AlertTriangle, BarChart3, Building2, CreditCard, Loader2, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  getAdminBillingConfig,
  getAdminStats,
  getBalanceAlerts,
  getOrgBillingPolicy,
  listAdminOrganizations,
  rechargeOrganization,
  updateAdminBillingConfig,
  updateOrgBillingPolicy,
  type AdminBillingConfig,
  type AdminOrganization,
  type AdminStats,
  type BalanceAlert,
  type OrgBillingPolicy,
} from '@/lib/admin';

function formatTime(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function StatCard({ title, value, icon }: { title: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="yj-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-fg-muted">{title}</p>
          <p className="text-2xl font-semibold text-fg-default mt-1">{value}</p>
        </div>
        <div className="text-accent-fg">{icon}</div>
      </div>
    </div>
  );
}

const emptyStats: AdminStats = {
  organizations: { total: 0, active: 0, suspended: 0 },
  tasks: { running: 0, completed: 0, failed: 0, today_created: 0, today_finished: 0 },
  credits: {
    total_consumed_today: 0,
    total_consumed_month: 0,
    total_recharged_today: 0,
    total_recharged_month: 0,
    orgs_low_balance: 0,
  },
  top_orgs: [],
  recent_tasks: [],
};

const emptyBillingConfig: AdminBillingConfig = {
  credits_per_minute: 0,
  credit_rate_multiplier: 1,
  min_balance: 0,
};

export default function AdminPage() {
  const { isLoading: authLoading, isPlatformAdmin } = useAuth();
  const [stats, setStats] = React.useState<AdminStats>(emptyStats);
  const [alerts, setAlerts] = React.useState<BalanceAlert[]>([]);
  const [organizations, setOrganizations] = React.useState<AdminOrganization[]>([]);
  const [billingConfig, setBillingConfig] = React.useState<AdminBillingConfig>(emptyBillingConfig);
  const [configForm, setConfigForm] = React.useState({
    creditsPerMinute: '',
    creditRateMultiplier: '',
    minBalance: '',
  });
  const [rechargeForm, setRechargeForm] = React.useState({
    orgId: '',
    amount: '',
    description: '',
  });
  const [policyOrgId, setPolicyOrgId] = React.useState('');
  const [policy, setPolicy] = React.useState<OrgBillingPolicy | null>(null);
  const [policyForm, setPolicyForm] = React.useState({
    creditsPerMinute: '',
    creditRateMultiplier: '',
    minBalance: '',
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSavingBilling, setIsSavingBilling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextStats, nextAlerts, nextOrganizations, nextBillingConfig] = await Promise.all([
        getAdminStats(),
        getBalanceAlerts(),
        listAdminOrganizations(),
        getAdminBillingConfig(),
      ]);
      setStats(nextStats);
      setAlerts(nextAlerts);
      setOrganizations(nextOrganizations);
      setBillingConfig(nextBillingConfig);
      setConfigForm({
        creditsPerMinute: String(nextBillingConfig.credits_per_minute),
        creditRateMultiplier: String(nextBillingConfig.credit_rate_multiplier),
        minBalance: String(nextBillingConfig.min_balance),
      });
      setRechargeForm((prev) => ({
        ...prev,
        orgId: prev.orgId || nextOrganizations[0]?.id || '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载管理后台数据失败');
      setStats(emptyStats);
      setAlerts([]);
      setOrganizations([]);
      setBillingConfig(emptyBillingConfig);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!authLoading && isPlatformAdmin()) {
      void loadData();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, isPlatformAdmin, loadData]);

  const submitRecharge = async (event: React.FormEvent) => {
    event.preventDefault();
    const orgId = rechargeForm.orgId.trim();
    const amount = Number(rechargeForm.amount);
    if (!orgId || !Number.isInteger(amount) || amount <= 0) {
      setError('请选择机构并输入大于 0 的整数充值点数');
      return;
    }

    setIsSavingBilling(true);
    setError(null);
    setActionMessage(null);
    try {
      const result = await rechargeOrganization({
        org_id: orgId,
        amount,
        ...(rechargeForm.description.trim() ? { description: rechargeForm.description.trim() } : {}),
      });
      setActionMessage(`已为机构 ${result.org_id} 充值，当前余额 ${result.balance}`);
      setRechargeForm((prev) => ({ ...prev, amount: '', description: '' }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '充值失败');
    } finally {
      setIsSavingBilling(false);
    }
  };

  const submitBillingConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    const creditsPerMinute = Number(configForm.creditsPerMinute);
    const creditRateMultiplier = Number(configForm.creditRateMultiplier);
    const minBalance = Number(configForm.minBalance);
    if (!Number.isInteger(creditsPerMinute) || creditsPerMinute <= 0 || !Number.isFinite(creditRateMultiplier) || creditRateMultiplier <= 0 || !Number.isInteger(minBalance)) {
      setError('请填写有效的计费配置：每分钟点数为正整数，倍率为正数，最低余额为整数');
      return;
    }

    setIsSavingBilling(true);
    setError(null);
    setActionMessage(null);
    try {
      const next = await updateAdminBillingConfig({
        credits_per_minute: creditsPerMinute,
        credit_rate_multiplier: creditRateMultiplier,
        min_balance: minBalance,
      });
      setBillingConfig(next);
      setActionMessage('全局计费配置已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新计费配置失败');
    } finally {
      setIsSavingBilling(false);
    }
  };

  const loadOrgPolicy = async (orgId = policyOrgId) => {
    const normalizedOrgId = orgId.trim();
    if (!normalizedOrgId) {
      setPolicy(null);
      setPolicyForm({ creditsPerMinute: '', creditRateMultiplier: '', minBalance: '' });
      return;
    }

    setIsSavingBilling(true);
    setError(null);
    try {
      const next = await getOrgBillingPolicy(normalizedOrgId);
      setPolicy(next);
      setPolicyForm({
        creditsPerMinute: next.overrides.credits_per_minute == null ? '' : String(next.overrides.credits_per_minute),
        creditRateMultiplier: next.overrides.credit_rate_multiplier == null ? '' : String(next.overrides.credit_rate_multiplier),
        minBalance: next.overrides.min_balance == null ? '' : String(next.overrides.min_balance),
      });
    } catch (err) {
      setPolicy(null);
      setError(err instanceof Error ? err.message : '加载机构计费策略失败');
    } finally {
      setIsSavingBilling(false);
    }
  };

  const submitOrgPolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    const orgId = policyOrgId.trim();
    if (!orgId) {
      setError('请选择机构');
      return;
    }

    const creditsPerMinute = policyForm.creditsPerMinute.trim() ? Number(policyForm.creditsPerMinute) : undefined;
    const creditRateMultiplier = policyForm.creditRateMultiplier.trim() ? Number(policyForm.creditRateMultiplier) : undefined;
    const minBalance = policyForm.minBalance.trim() ? Number(policyForm.minBalance) : undefined;
    if (
      (creditsPerMinute !== undefined && (!Number.isInteger(creditsPerMinute) || creditsPerMinute <= 0)) ||
      (creditRateMultiplier !== undefined && (!Number.isFinite(creditRateMultiplier) || creditRateMultiplier <= 0)) ||
      (minBalance !== undefined && !Number.isInteger(minBalance))
    ) {
      setError('机构计费覆盖值格式不正确');
      return;
    }

    setIsSavingBilling(true);
    setError(null);
    setActionMessage(null);
    try {
      const next = await updateOrgBillingPolicy(orgId, {
        ...(creditsPerMinute === undefined ? { reset_credits_per_minute: true } : { credits_per_minute: creditsPerMinute }),
        ...(creditRateMultiplier === undefined ? { reset_credit_rate_multiplier: true } : { credit_rate_multiplier: creditRateMultiplier }),
        ...(minBalance === undefined ? { reset_min_balance: true } : { min_balance: minBalance }),
      });
      setPolicy(next);
      setActionMessage('机构计费策略已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新机构计费策略失败');
    } finally {
      setIsSavingBilling(false);
    }
  };

  const alertColumns: Column<BalanceAlert>[] = [
    { id: 'org_name', header: '机构', accessor: 'org_name', width: 220, align: 'center' },
    { id: 'balance', header: '余额', accessor: (row) => row.balance, width: 100, align: 'center' },
    { id: 'threshold', header: '预警阈值', accessor: (row) => row.threshold, width: 120, align: 'center' },
    {
      id: 'is_active',
      header: '状态',
      accessor: (row) => <Tag variant={row.is_active ? 'success' : 'neutral'}>{row.is_active ? '启用' : '停用'}</Tag>,
      width: 100,
      align: 'center',
    },
  ];

  const orgColumns: Column<AdminOrganization>[] = [
    { id: 'name', header: '机构', accessor: 'name', width: 220, align: 'center' },
    { id: 'slug', header: 'Slug', accessor: 'slug', width: 160, align: 'center' },
    {
      id: 'is_active',
      header: '状态',
      accessor: (row) => <Tag variant={row.is_active ? 'success' : 'neutral'}>{row.is_active ? '启用' : '停用'}</Tag>,
      width: 100,
      align: 'center',
    },
    { id: 'max_concurrent_tasks', header: '并发上限', accessor: (row) => row.max_concurrent_tasks, width: 110, align: 'center' },
    { id: 'balance_alert_threshold', header: '余额阈值', accessor: (row) => row.balance_alert_threshold, width: 110, align: 'center' },
    { id: 'storage_quota_bytes', header: '存储配额', accessor: (row) => formatBytes(row.storage_quota_bytes), width: 120, align: 'center' },
  ];

  const topOrgColumns: Column<AdminStats['top_orgs'][number]>[] = [
    { id: 'org_name', header: '机构', accessor: 'org_name', width: 200, align: 'center' },
    { id: 'balance', header: '余额', accessor: (row) => row.balance, width: 100, align: 'center' },
    { id: 'task_count', header: '任务数', accessor: (row) => row.task_count, width: 100, align: 'center' },
    { id: 'credits_used_today', header: '今日消耗', accessor: (row) => row.credits_used_today, width: 120, align: 'center' },
  ];

  const taskColumns: Column<AdminStats['recent_tasks'][number]>[] = [
    { id: 'name', header: '任务', accessor: 'name', width: 240, align: 'center' },
    { id: 'org_name', header: '机构', accessor: 'org_name', width: 180, align: 'center' },
    { id: 'status', header: '状态', accessor: (row) => <Tag variant="info">{row.status}</Tag>, width: 100, align: 'center' },
    { id: 'created_at', header: '创建时间', accessor: (row) => formatTime(row.created_at), width: 180, align: 'center' },
  ];

  if (authLoading || isLoading) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <Loader2 className="w-6 h-6 animate-spin text-accent-fg" />
          <p className="text-fg-muted">正在加载管理后台...</p>
        </div>
      </PageContent>
    );
  }

  if (!isPlatformAdmin()) {
    return (
      <PageContent className="yj-page-shell">
        <div className="yj-empty-state">
          <p className="text-fg-muted">您没有权限访问平台管理后台。</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">平台管理后台</h2>
          <p className="yj-page-subtitle">
            数据来自 Squid `/api/v1/admin/stats`、`/api/v1/admin/alerts` 和 `/api/v1/admin/orgs`，不再使用前端 mock 账号或本地机构状态。
          </p>
        </div>
        <Button variant="secondary" onClick={() => void loadData()}>
          <RefreshCw className="w-4 h-4" />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="机构总数" value={stats.organizations.total} icon={<Users className="w-6 h-6" />} />
        <StatCard title="运行中任务" value={stats.tasks.running} icon={<BarChart3 className="w-6 h-6" />} />
        <StatCard title="今日消耗点数" value={stats.credits.total_consumed_today} icon={<CreditCard className="w-6 h-6" />} />
        <StatCard title="低余额机构" value={stats.credits.orgs_low_balance} icon={<AlertTriangle className="w-6 h-6" />} />
      </div>

      {actionMessage && (
        <div className="rounded-md border border-success-muted bg-success-subtle px-4 py-3 text-sm text-success-fg">
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <form className="yj-panel p-4 space-y-3" onSubmit={submitRecharge}>
          <div>
            <h3 className="text-base font-medium text-fg-default">机构充值</h3>
            <p className="text-xs text-fg-muted mt-1">调用 Squid `POST /api/v1/admin/billing/recharge`，不再用本地状态模拟余额。</p>
          </div>
          <label className="block text-xs text-fg-muted">
            机构
            <select
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              value={rechargeForm.orgId}
              onChange={(e) => setRechargeForm((prev) => ({ ...prev, orgId: e.target.value }))}
            >
              <option value="">请选择机构</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-fg-muted">
            充值点数
            <input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={1}
              step={1}
              value={rechargeForm.amount}
              onChange={(e) => setRechargeForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="例如 1000"
            />
          </label>
          <label className="block text-xs text-fg-muted">
            备注
            <input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              value={rechargeForm.description}
              onChange={(e) => setRechargeForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="可选"
            />
          </label>
          <Button type="submit" variant="primary" disabled={isSavingBilling}>提交充值</Button>
        </form>

        <form className="yj-panel p-4 space-y-3" onSubmit={submitBillingConfig}>
          <div>
            <h3 className="text-base font-medium text-fg-default">全局计费配置</h3>
            <p className="text-xs text-fg-muted mt-1">当前：{billingConfig.credits_per_minute} 点/分钟，倍率 {billingConfig.credit_rate_multiplier}，最低余额 {billingConfig.min_balance}</p>
          </div>
          <label className="block text-xs text-fg-muted">
            每分钟点数
            <input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={1}
              step={1}
              value={configForm.creditsPerMinute}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, creditsPerMinute: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-fg-muted">
            费率倍率
            <input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={0.0001}
              step="0.0001"
              value={configForm.creditRateMultiplier}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, creditRateMultiplier: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-fg-muted">
            最低余额
            <input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              step={1}
              value={configForm.minBalance}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, minBalance: e.target.value }))}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={isSavingBilling}>保存全局配置</Button>
        </form>

        <form className="yj-panel p-4 space-y-3" onSubmit={submitOrgPolicy}>
          <div>
            <h3 className="text-base font-medium text-fg-default">机构计费覆盖</h3>
            <p className="text-xs text-fg-muted mt-1">留空会调用 reset 字段清除覆盖值，恢复继承全局配置。</p>
          </div>
          <label className="block text-xs text-fg-muted">
            机构
            <select
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              value={policyOrgId}
              onChange={(e) => {
                setPolicyOrgId(e.target.value);
                void loadOrgPolicy(e.target.value);
              }}
            >
              <option value="">请选择机构</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
              ))}
            </select>
          </label>
          {policy && (
            <p className="text-xs text-fg-muted">
              生效值：{policy.credits_per_minute} 点/分钟，倍率 {policy.credit_rate_multiplier}，最低余额 {policy.min_balance}
            </p>
          )}
          <label className="block text-xs text-fg-muted">
            覆盖每分钟点数
            <input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={1}
              step={1}
              value={policyForm.creditsPerMinute}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, creditsPerMinute: e.target.value }))}
              placeholder="留空继承全局"
            />
          </label>
          <label className="block text-xs text-fg-muted">
            覆盖费率倍率
            <input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={0.0001}
              step="0.0001"
              value={policyForm.creditRateMultiplier}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, creditRateMultiplier: e.target.value }))}
              placeholder="留空继承全局"
            />
          </label>
          <label className="block text-xs text-fg-muted">
            覆盖最低余额
            <input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              step={1}
              value={policyForm.minBalance}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, minBalance: e.target.value }))}
              placeholder="留空继承全局"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={isSavingBilling || !policyOrgId}>保存机构策略</Button>
        </form>
      </div>

      <div className="yj-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-accent-fg" />
          <h3 className="text-base font-medium text-fg-default">机构列表</h3>
        </div>
        {organizations.length === 0 ? (
          <p className="text-sm text-fg-muted">暂无机构数据</p>
        ) : (
          <DataTable data={organizations} columns={orgColumns} rowKey="id" density="default" striped />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="yj-panel p-4">
          <h3 className="text-base font-medium text-fg-default mb-3">余额预警</h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-fg-muted">暂无低余额机构</p>
          ) : (
            <DataTable data={alerts} columns={alertColumns} rowKey="org_id" density="default" striped />
          )}
        </div>
        <div className="yj-panel p-4">
          <h3 className="text-base font-medium text-fg-default mb-3">高消耗机构</h3>
          {stats.top_orgs.length === 0 ? (
            <p className="text-sm text-fg-muted">暂无机构消耗数据</p>
          ) : (
            <DataTable data={stats.top_orgs} columns={topOrgColumns} rowKey="org_id" density="default" striped />
          )}
        </div>
      </div>

      <div className="yj-panel p-4">
        <h3 className="text-base font-medium text-fg-default mb-3">最近任务</h3>
        {stats.recent_tasks.length === 0 ? (
          <p className="text-sm text-fg-muted">暂无最近任务</p>
        ) : (
          <DataTable data={stats.recent_tasks} columns={taskColumns} rowKey="id" density="default" striped />
        )}
      </div>
    </PageContent>
  );
}
