'use client';
import { formatNumericString } from '@/i18n/format';

﻿
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { AppModal } from '@/components/shared';
import { PageContent } from '@/components/layout';
import { DataTable } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import type { Column } from '@schema/ui-kit';
import { AlertTriangle, BarChart3, Building2, CreditCard, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { hashPassword } from '@/lib/crypto';
import {
  getAdminBillingConfig,
  getAdminStats,
  getBalanceAlerts,
  getOrgBillingPolicy,
  listAdminOrganizations,
  provisionOrganization,
  rechargeOrganization,
  updateAdminBillingConfig,
  updateAdminOrganization,
  updateOrgBillingPolicy,
  type AdminBillingConfig,
  type AdminOrganization,
  type AdminStats,
  type BalanceAlert,
  type OrgBillingPolicy,
  type UpdateAdminOrganizationInput,
} from '@/lib/admin';

function formatTime(value: string, t: TextTranslator = chineseText): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(t.locale, { hour12: false });
}

function formatBytes(value: number, t: TextTranslator = chineseText): string {
  if (!Number.isFinite(value) || value <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${formatNumericString(size.toFixed(unit === 0 ? 0 : 1), t.locale)} ${units[unit]}`;
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs text-fg-muted">
      {label}
      {required ? ' *' : ''}
      <input
        className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
        type={type}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
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
  const t = useText();
  const { isLoading: authLoading, isPlatformAdmin } = useAuth();
  const [provisionOpen, setProvisionOpen] = React.useState(false);
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
  const [provisionForm, setProvisionForm] = React.useState({
    name: '',
    slug: '',
    description: '',
    maxConcurrentTasks: '5',
    adminEmail: '',
    adminPassword: '',
    adminName: '',
  });
  const [editingOrg, setEditingOrg] = React.useState<AdminOrganization | null>(null);
  const [orgForm, setOrgForm] = React.useState({
    name: '',
    description: '',
    maxConcurrentTasks: '',
    balanceAlertThreshold: '',
    storageQuotaGb: '',
    isActive: true,
  });
  const [policyOrgId, setPolicyOrgId] = React.useState('');
  const [policy, setPolicy] = React.useState<OrgBillingPolicy | null>(null);
  const [policyForm, setPolicyForm] = React.useState({
    creditsPerMinute: '',
    creditRateMultiplier: '',
    minBalance: '',
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasLoaded, setHasLoaded] = React.useState(false);
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
      setHasLoaded(true);
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
      setError(err instanceof Error ? errorText(err, t) : t("admin.unableToLoadAdministrationDataaeecf7"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (!authLoading && isPlatformAdmin()) {
      void loadData();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, isPlatformAdmin, loadData]);

  const openEditOrg = (org: AdminOrganization) => {
    setEditingOrg(org);
    setOrgForm({
      name: org.name,
      description: org.description ?? '',
      maxConcurrentTasks: String(org.max_concurrent_tasks),
      balanceAlertThreshold: String(org.balance_alert_threshold),
      storageQuotaGb: org.storage_quota_bytes > 0 ? String(Math.round(org.storage_quota_bytes / 1024 / 1024 / 1024)) : '',
      isActive: org.is_active,
    });
    setError(null);
    setActionMessage(null);
  };

  const submitProvisionOrg = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = provisionForm.name.trim();
    const slug = provisionForm.slug.trim().toLowerCase();
    const adminEmail = provisionForm.adminEmail.trim().toLowerCase();
    const adminName = provisionForm.adminName.trim();
    const maxConcurrentTasks = Number(provisionForm.maxConcurrentTasks);
    if (!name || !slug || !adminEmail || !adminName || !provisionForm.adminPassword) {
      setError(t("admin.enterTheOrganizationNameSlugAdministratorEmailb82065"));
      return;
    }
    if (!Number.isInteger(maxConcurrentTasks) || maxConcurrentTasks <= 0) {
      setError(t("admin.concurrencyLimitMustBeAPositiveIntegerf8f843"));
      return;
    }

    setIsSavingBilling(true);
    setError(null);
    setActionMessage(null);
    try {
      const adminPassword = await hashPassword(provisionForm.adminPassword, adminEmail);
      const result = await provisionOrganization({
        name,
        slug,
        admin_email: adminEmail,
        admin_name: adminName,
        admin_password: adminPassword,
        max_concurrent_tasks: maxConcurrentTasks,
        ...(provisionForm.description.trim() ? { description: provisionForm.description.trim() } : {}),
      });
      setProvisionOpen(false);
      setActionMessage(t("admin.organizationCreatedAdministratorAccountb0bcd9", {p0: String(result.organization.name), p1: String(result.account.email)}));
      setProvisionForm({
        name: '',
        slug: '',
        description: '',
        maxConcurrentTasks: '5',
        adminEmail: '',
        adminPassword: '',
        adminName: '',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("admin.unableToCreateOrganization494525"));
    } finally {
      setIsSavingBilling(false);
    }
  };

  const submitOrgUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingOrg) return;
    const name = orgForm.name.trim();
    const maxConcurrentTasks = Number(orgForm.maxConcurrentTasks);
    const balanceAlertThreshold = Number(orgForm.balanceAlertThreshold);
    const storageQuotaGb = orgForm.storageQuotaGb.trim() ? Number(orgForm.storageQuotaGb) : 0;
    if (!name) {
      setError(t("admin.enterTheOrganizationNameef51c0"));
      return;
    }
    if (!Number.isInteger(maxConcurrentTasks) || maxConcurrentTasks < 0 || !Number.isInteger(balanceAlertThreshold) || balanceAlertThreshold < 0) {
      setError(t("admin.concurrencyAndBalanceThresholdsMustBeNonnegative721def"));
      return;
    }
    if (!Number.isFinite(storageQuotaGb) || storageQuotaGb < 0) {
      setError(t("admin.storageQuotaMustBeANonnegativeNumber7c2795"));
      return;
    }

    const input: UpdateAdminOrganizationInput = {
      name,
      description: orgForm.description.trim(),
      max_concurrent_tasks: maxConcurrentTasks,
      balance_alert_threshold: balanceAlertThreshold,
      storage_quota_bytes: Math.round(storageQuotaGb * 1024 * 1024 * 1024),
      is_active: orgForm.isActive,
    };
    setIsSavingBilling(true);
    setError(null);
    setActionMessage(null);
    try {
      const updated = await updateAdminOrganization(editingOrg.id, input);
      setOrganizations((prev) => prev.map((org) => (org.id === updated.id ? updated : org)));
      setEditingOrg(null);
      setActionMessage(t("admin.organizationUpdatedb05d7e", {p0: String(updated.name)}));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("admin.unableToUpdateOrganization1be3f1"));
    } finally {
      setIsSavingBilling(false);
    }
  };

  const submitRecharge = async (event: React.FormEvent) => {
    event.preventDefault();
    const orgId = rechargeForm.orgId.trim();
    const amount = Number(rechargeForm.amount);
    if (!orgId || !Number.isInteger(amount) || amount <= 0) {
      setError(t("admin.selectAnOrganizationAndEnterAPositive7b887d"));
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
      setActionMessage(t("admin.organizationCreditedCurrentBalancea26e6c", {p0: String(result.org_id), p1: String(result.balance)}));
      setRechargeForm((prev) => ({ ...prev, amount: '', description: '' }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("admin.unableToAddCredits336ad2"));
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
      setError(t("admin.enterValidBillingSettingsPositiveIntegerCredits0ec80e"));
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
      setActionMessage(t("admin.globalBillingSettingsUpdated6e76fc"));
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("admin.unableToUpdateBillingSettings3b50ad"));
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
      setError(err instanceof Error ? errorText(err, t) : t("admin.unableToLoadOrganizationBillingPolicy40fe81"));
    } finally {
      setIsSavingBilling(false);
    }
  };

  const submitOrgPolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    const orgId = policyOrgId.trim();
    if (!orgId) {
      setError(t("admin.selectAnOrganizationcd17b7"));
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
      setError(t("admin.invalidOrganizationBillingOverrideValues57c4a2"));
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
      setActionMessage(t("admin.organizationBillingPolicyUpdated8a9e34"));
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("admin.unableToUpdateOrganizationBillingPolicy77c1e4"));
    } finally {
      setIsSavingBilling(false);
    }
  };

  const alertColumns: Column<BalanceAlert>[] = [
    { id: 'org_name', header: t("admin.organization5f8fc2"), accessor: 'org_name', width: 220, align: 'center' },
    { id: 'balance', header: t("admin.balance51cc55"), accessor: (row) => row.balance, width: 100, align: 'center' },
    { id: 'threshold', header: t("admin.alertThreshold719529"), accessor: (row) => row.threshold, width: 120, align: 'center' },
    {
      id: 'is_active',
      header: t("admin.status62e951"),
      accessor: (row) => <Tag variant={row.is_active ? 'success' : 'neutral'}>{row.is_active ? t("admin.enabledd4e9ca") : t("admin.disabledd989e5")}</Tag>,
      width: 100,
      align: 'center',
    },
  ];

  const orgColumns: Column<AdminOrganization>[] = [
    { id: 'name', header: t("admin.organization5f8fc2"), accessor: 'name', width: 220, align: 'center' },
    { id: 'slug', header: 'Slug', accessor: 'slug', width: 160, align: 'center' },
    {
      id: 'is_active',
      header: t("admin.status62e951"),
      accessor: (row) => <Tag variant={row.is_active ? 'success' : 'neutral'}>{row.is_active ? t("admin.enabledd4e9ca") : t("admin.disabledd989e5")}</Tag>,
      width: 100,
      align: 'center',
    },
    { id: 'max_concurrent_tasks', header: t("admin.concurrencyLimit118e6a"), accessor: (row) => row.max_concurrent_tasks, width: 110, align: 'center' },
    { id: 'balance_alert_threshold', header: t("admin.balanceThresholdcf1126"), accessor: (row) => row.balance_alert_threshold, width: 110, align: 'center' },
    { id: 'storage_quota_bytes', header: t("admin.storageQuota5960b4"), accessor: (row) => formatBytes(row.storage_quota_bytes, t), width: 120, align: 'center' },
    {
      id: 'actions',
      header: t("admin.actionsf3ea6d"),
      accessor: (row) => (
        <ActionButton action="edit" variant="ghost"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-accent-fg hover:bg-canvas-subtle"
          onClick={() => openEditOrg(row)}
        >

          {t("admin.edita7f814")}</ActionButton>
      ),
      width: 90,
      align: 'center',
    },
  ];

  const topOrgColumns: Column<AdminStats['top_orgs'][number]>[] = [
    { id: 'org_name', header: t("admin.organization5f8fc2"), accessor: 'org_name', width: 200, align: 'center' },
    { id: 'balance', header: t("admin.balance51cc55"), accessor: (row) => row.balance, width: 100, align: 'center' },
    { id: 'task_count', header: t("admin.taskCountcd75bc"), accessor: (row) => row.task_count, width: 100, align: 'center' },
    { id: 'credits_used_today', header: t("admin.usageTodayc20f62"), accessor: (row) => row.credits_used_today, width: 120, align: 'center' },
  ];

  const taskColumns: Column<AdminStats['recent_tasks'][number]>[] = [
    { id: 'name', header: t("admin.task3172b3"), accessor: 'name', width: 240, align: 'center' },
    { id: 'org_name', header: t("admin.organization5f8fc2"), accessor: 'org_name', width: 180, align: 'center' },
    { id: 'status', header: t("admin.status62e951"), accessor: (row) => <Tag variant={row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'running' ? 'info' : 'neutral'}>{({completed:t("admin.completede99b48"),failed:t("admin.failed3e3c80"),running:t("admin.running594249"),cancelled:t("admin.canceleda5ffdc"),pending:t("admin.waiting25d23b"),queued:t("admin.queued4dcbbc")} as Record<string,string>)[row.status] ?? row.status}</Tag>, width: 100, align: 'center' },
    { id: 'created_at', header: t("admin.createdAt84e380"), accessor: (row) => formatTime(row.created_at, t), width: 180, align: 'center' },
  ];

  if (authLoading || isLoading) {
    return (
      <PageContent className="yj-page-shell space-y-4">
        <div className="yj-empty-state">
          <Loader2 className="w-6 h-6 animate-spin text-accent-fg" />
          <p className="text-fg-muted">{t("admin.loadingAdministration039999")}</p>
        </div>
      </PageContent>
    );
  }

  if (!isPlatformAdmin()) {
    return (
      <PageContent className="yj-page-shell space-y-4">
        <div className="yj-empty-state">
          <p className="text-fg-muted">{t("admin.youDoNotHavePermissionToAccess7fdc18")}</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent className="yj-page-shell space-y-4">
      <div className="yj-page-header flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="yj-page-title">{t("admin.platformAdministrationa475a9")}</h2>
          <p className="yj-page-subtitle">
            {t("admin.manageOrganizationsRunningTasksAndCreditPolicies300dda")}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button action="refresh" variant="secondary" className="yj-tool-button"  onClick={() => void loadData()}>{t("admin.refresh38108e")}</Button>
          <Button action="add" variant="primary"  onClick={() => { setError(null); setProvisionOpen(true); }}>{t("admin.createOrganizationf0a805")}</Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title={t("admin.totalOrganizationsfa16b3")} value={!hasLoaded ? '—' : stats.organizations.total} icon={<Users className="w-6 h-6" />} />
        <StatCard title={t("admin.runningTasks6706fb")} value={!hasLoaded ? '—' : stats.tasks.running} icon={<BarChart3 className="w-6 h-6" />} />
        <StatCard title={t("admin.creditsUsedToday470061")} value={!hasLoaded ? '—' : stats.credits.total_consumed_today} icon={<CreditCard className="w-6 h-6" />} />
        <StatCard title={t("admin.lowBalanceOrganizationsf2bf55")} value={!hasLoaded ? '—' : stats.credits.orgs_low_balance} icon={<AlertTriangle className="w-6 h-6" />} />
      </div>

      {actionMessage && (
        <div className="rounded-md border border-success-muted bg-success-subtle px-4 py-3 text-sm text-success-fg">
          {actionMessage}
        </div>
      )}

      {hasLoaded && <>
      <div className="yj-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-accent-fg" />
          <h3 className="text-base font-medium text-fg-default">{t("admin.organizationsc6d8c4")}</h3>
        </div>
        {organizations.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("admin.noOrganizations8e54aa")}</p>
        ) : (
          <div className="[&_table]:min-w-[910px]"><DataTable data={organizations} columns={localizeDisplay(orgColumns, t)} rowKey="id" density="default" striped /></div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="yj-panel p-4">
          <h3 className="text-base font-medium text-fg-default mb-3">{t("admin.balanceAlertsd0f155")}</h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-fg-muted">{t("admin.noLowBalanceOrganizationsdd06a5")}</p>
          ) : (
            <div className="[&_table]:min-w-[450px]"><DataTable data={alerts} columns={localizeDisplay(alertColumns, t)} rowKey="org_id" density="default" striped /></div>
          )}
        </div>
        <div className="yj-panel p-4">
          <h3 className="text-base font-medium text-fg-default mb-3">{t("admin.highUsageOrganizationsb3ee1e")}</h3>
          {stats.top_orgs.length === 0 ? (
            <p className="text-sm text-fg-muted">{t("admin.noOrganizationUsageData7de821")}</p>
          ) : (
            <div className="[&_table]:min-w-[450px]"><DataTable data={stats.top_orgs} columns={localizeDisplay(topOrgColumns, t)} rowKey="org_id" density="default" striped /></div>
          )}
        </div>
      </div>

      <div className="yj-panel p-4">
        <h3 className="text-base font-medium text-fg-default mb-3">{t("admin.recentTasksabc5c3")}</h3>
        {stats.recent_tasks.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("admin.noRecentTasks6e7058")}</p>
        ) : (
          <div className="[&_table]:min-w-[700px]"><DataTable data={stats.recent_tasks} columns={localizeDisplay(taskColumns, t)} rowKey="id" density="default" striped /></div>
        )}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <form className="yj-panel p-4 space-y-3" onSubmit={submitRecharge}>
          <div>
            <h3 className="text-base font-medium text-fg-default">{t("admin.addOrganizationCreditsbb90b7")}</h3>
            <p className="text-xs text-fg-muted mt-1">{t("admin.creditsAreAddedToTheOrganizationBalance3ef1d0")}</p>
          </div>
          <label className="block text-xs text-fg-muted">
            {t("admin.organization5f8fc2")}<select
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              value={rechargeForm.orgId}
              onChange={(e) => setRechargeForm((prev) => ({ ...prev, orgId: e.target.value }))}
            >
              <option value="">{t("admin.selectAnOrganizationcd17b7")}</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-fg-muted">
            {t("admin.creditsToAdd3d02b4")}<input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={1}
              step={1}
              value={rechargeForm.amount}
              onChange={(e) => setRechargeForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder={t("admin.forExample3602a7")}
            />
          </label>
          <label className="block text-xs text-fg-muted">
            {t("admin.notese03614")}<input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              value={rechargeForm.description}
              onChange={(e) => setRechargeForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={t("admin.optional53e328")}
            />
          </label>
          <Button type="submit" variant="primary" disabled={isSavingBilling}>{t("admin.submitCreditAddition0cf1a1")}</Button>
        </form>

        <form className="yj-panel p-4 space-y-3" onSubmit={submitBillingConfig}>
          <div>
            <h3 className="text-base font-medium text-fg-default">{t("admin.globalBillingSettings1ce7d4")}</h3>
            <p className="text-xs text-fg-muted mt-1">{t("admin.current23ef9f")}{billingConfig.credits_per_minute} {t("admin.creditsMinuteMultiplier731649")}{billingConfig.credit_rate_multiplier}{t("admin.minimumBalance7994b9")}{billingConfig.min_balance}</p>
          </div>
          <label className="block text-xs text-fg-muted">
            {t("admin.creditsPerMinute9ab621")}<input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={1}
              step={1}
              value={configForm.creditsPerMinute}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, creditsPerMinute: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-fg-muted">
            {t("admin.rateMultiplier07b006")}<input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={0.0001}
              step="0.0001"
              value={configForm.creditRateMultiplier}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, creditRateMultiplier: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-fg-muted">
            {t("admin.minimumBalancef76d28")}<input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              step={1}
              value={configForm.minBalance}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, minBalance: e.target.value }))}
            />
          </label>
          <Button action="save" type="submit" variant="secondary" disabled={isSavingBilling}>{t("admin.saveGlobalSettingsa563fe")}</Button>
        </form>

        <form className="yj-panel p-4 space-y-3" onSubmit={submitOrgPolicy}>
          <div>
            <h3 className="text-base font-medium text-fg-default">{t("admin.organizationBillingOverrides03f013")}</h3>
            <p className="text-xs text-fg-muted mt-1">{t("admin.leaveBlankAndSaveToRestoreThe4f54a4")}</p>
          </div>
          <label className="block text-xs text-fg-muted">
            {t("admin.organization5f8fc2")}<select
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              value={policyOrgId}
              onChange={(e) => {
                setPolicyOrgId(e.target.value);
                void loadOrgPolicy(e.target.value);
              }}
            >
              <option value="">{t("admin.selectAnOrganizationcd17b7")}</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
              ))}
            </select>
          </label>
          {policy && (
            <p className="text-xs text-fg-muted">
              {t("admin.effectiveValues3f0c90")}{policy.credits_per_minute} {t("admin.creditsMinuteMultiplier731649")}{policy.credit_rate_multiplier}{t("admin.minimumBalance7994b9")}{policy.min_balance}
            </p>
          )}
          <label className="block text-xs text-fg-muted">
            {t("admin.overrideCreditsPerMinute4c1d9b")}<input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={1}
              step={1}
              value={policyForm.creditsPerMinute}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, creditsPerMinute: e.target.value }))}
              placeholder={t("admin.leaveBlankToInheritGlobalSettingsd500b4")}
            />
          </label>
          <label className="block text-xs text-fg-muted">
            {t("admin.overrideRateMultiplier039198")}<input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              min={0.0001}
              step="0.0001"
              value={policyForm.creditRateMultiplier}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, creditRateMultiplier: e.target.value }))}
              placeholder={t("admin.leaveBlankToInheritGlobalSettingsd500b4")}
            />
          </label>
          <label className="block text-xs text-fg-muted">
            {t("admin.overrideMinimumBalance4b85e6")}<input
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              type="number"
              step={1}
              value={policyForm.minBalance}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, minBalance: e.target.value }))}
              placeholder={t("admin.leaveBlankToInheritGlobalSettingsd500b4")}
            />
          </label>
          <Button action="save" type="submit" variant="secondary" disabled={isSavingBilling || !policyOrgId}>{t("admin.saveOrganizationPolicy7b1998")}</Button>
        </form>
      </div>

      </>}

      <AppModal open={provisionOpen} onOpenChange={(open) => { if (!isSavingBilling) setProvisionOpen(open); }} title={t("admin.createOrganizationAndAdministratorAccount045178")} size="large" footer={<><Button variant="secondary" onClick={() => setProvisionOpen(false)} disabled={isSavingBilling}>{t("admin.cancel4d0b46")}</Button><Button loading={isSavingBilling} loadingLabel={t("admin.creatingc16c57")} form="admin-provision" type="submit" variant="primary" disabled={isSavingBilling}>{t("admin.createOrganizationf0a805")}</Button></>}>
        <form id="admin-provision" className="space-y-4" onSubmit={submitProvisionOrg}>
          {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("admin.organizationNamec50f05")} value={provisionForm.name} onChange={(value) => setProvisionForm((prev) => ({ ...prev, name: value }))} required />
            <Field label="Slug" value={provisionForm.slug} onChange={(value) => setProvisionForm((prev) => ({ ...prev, slug: value }))} required />
            <Field label={t("admin.concurrencyLimit118e6a")} type="number" value={provisionForm.maxConcurrentTasks} onChange={(value) => setProvisionForm((prev) => ({ ...prev, maxConcurrentTasks: value }))} required />
            <Field label={t("admin.administratorNamedf47bf")} value={provisionForm.adminName} onChange={(value) => setProvisionForm((prev) => ({ ...prev, adminName: value }))} required />
            <Field label={t("admin.administratorEmailfbe7f8")} type="email" value={provisionForm.adminEmail} onChange={(value) => setProvisionForm((prev) => ({ ...prev, adminEmail: value }))} required />
            <Field label={t("admin.initialPassword961fcb")} type="password" value={provisionForm.adminPassword} onChange={(value) => setProvisionForm((prev) => ({ ...prev, adminPassword: value }))} required />
          </div>
          <label className="block text-xs text-fg-muted">
            {t("admin.description412f54")}<textarea
              className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
              value={provisionForm.description}
              onChange={(e) => setProvisionForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </label>

                </form>
      </AppModal>
      <AppModal open={Boolean(editingOrg)} onOpenChange={(open) => { if (!open && !isSavingBilling) setEditingOrg(null); }} title={t("admin.editOrganizationSettingsa7d5bc")} size="large" footer={<><Button variant="secondary" onClick={() => setEditingOrg(null)} disabled={isSavingBilling}>{t("admin.cancel4d0b46")}</Button><Button loading={isSavingBilling} loadingLabel={t("admin.savingd70d42")} action="save" form="admin-edit-org" type="submit" variant="primary" disabled={isSavingBilling}>{t("admin.saveOrganizationSettings78fbe5")}</Button></>}>
        <form id="admin-edit-org" className="space-y-4" onSubmit={submitOrgUpdate}>
          {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
              <div className="text-xs text-fg-muted">{t("admin.currentOrganizationIdff0a93")}<span className="font-mono break-all">{editingOrg?.id}</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t("admin.organizationNamec50f05")} value={orgForm.name} onChange={(value) => setOrgForm((prev) => ({ ...prev, name: value }))} required />
                <Field label={t("admin.concurrencyLimit118e6a")} type="number" value={orgForm.maxConcurrentTasks} onChange={(value) => setOrgForm((prev) => ({ ...prev, maxConcurrentTasks: value }))} />
                <Field label={t("admin.balanceThresholdcf1126")} type="number" value={orgForm.balanceAlertThreshold} onChange={(value) => setOrgForm((prev) => ({ ...prev, balanceAlertThreshold: value }))} />
                <Field label={t("admin.storageQuotaInGb1fe38c")} type="number" value={orgForm.storageQuotaGb} onChange={(value) => setOrgForm((prev) => ({ ...prev, storageQuotaGb: value }))} />
              </div>
              <label className="block text-xs text-fg-muted">
                {t("admin.description412f54")}<textarea
                  className="mt-1 w-full rounded-md border border-border bg-canvas-default px-3 py-2 text-sm text-fg-default"
                  value={orgForm.description}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-fg-default">
                <input
                  type="checkbox"
                  checked={orgForm.isActive}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                {t("admin.organizationEnabled7b2c48")}</label>
        </form>
      </AppModal>
    </PageContent>
  );
}
