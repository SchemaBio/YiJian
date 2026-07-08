import { api } from './api';

export interface AdminStats {
  organizations: {
    total: number;
    active: number;
    suspended: number;
  };
  tasks: {
    running: number;
    completed: number;
    failed: number;
    today_created: number;
    today_finished: number;
  };
  credits: {
    total_consumed_today: number;
    total_consumed_month: number;
    total_recharged_today: number;
    total_recharged_month: number;
    orgs_low_balance: number;
  };
  top_orgs: Array<{
    org_id: string;
    org_name: string;
    balance: number;
    task_count: number;
    credits_used_today: number;
  }>;
  recent_tasks: Array<{
    id: string;
    name: string;
    org_name: string;
    status: string;
    created_at: string;
  }>;
}

export interface BalanceAlert {
  org_id: string;
  org_name: string;
  balance: number;
  threshold: number;
  is_active: boolean;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  max_concurrent_tasks: number;
  balance_alert_threshold: number;
  storage_quota_bytes: number;
  is_active: boolean;
}

export interface ProvisionOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  max_concurrent_tasks?: number;
  admin_email: string;
  admin_password: string;
  admin_name: string;
}

export interface ProvisionOrganizationResult {
  organization: AdminOrganization;
  account: {
    id: string;
    email: string;
    name: string;
    system_role: string;
    org_id: string;
    is_active: boolean;
  };
}

export interface UpdateAdminOrganizationInput {
  name?: string;
  description?: string;
  max_concurrent_tasks?: number;
  balance_alert_threshold?: number;
  storage_quota_bytes?: number;
  is_active?: boolean;
}

export interface AdminBillingConfig {
  credits_per_minute: number;
  credit_rate_multiplier: number;
  min_balance: number;
}

export interface UpdateAdminBillingConfigInput {
  credits_per_minute?: number;
  credit_rate_multiplier?: number;
  min_balance?: number;
}

export interface RechargeInput {
  org_id: string;
  amount: number;
  description?: string;
}

export interface RechargeResult {
  org_id: string;
  balance: number;
}

export interface OrgBillingPolicyOverrides {
  credits_per_minute?: number | null;
  credit_rate_multiplier?: number | null;
  min_balance?: number | null;
}

export interface OrgBillingPolicy {
  org_id: string;
  credits_per_minute: number;
  credit_rate_multiplier: number;
  min_balance: number;
  overrides: OrgBillingPolicyOverrides;
}

export interface UpdateOrgBillingPolicyInput {
  credits_per_minute?: number;
  credit_rate_multiplier?: number;
  min_balance?: number;
  reset_credits_per_minute?: boolean;
  reset_credit_rate_multiplier?: boolean;
  reset_min_balance?: boolean;
}

export async function getAdminStats(): Promise<AdminStats> {
  return api.get<AdminStats>('/v1/admin/stats', { coreApi: false });
}

export async function getBalanceAlerts(): Promise<BalanceAlert[]> {
  const data = await api.get<BalanceAlert[] | { alerts?: BalanceAlert[] }>('/v1/admin/alerts', { coreApi: false });
  return Array.isArray(data) ? data : data.alerts ?? [];
}

export async function listAdminOrganizations(): Promise<AdminOrganization[]> {
  const data = await api.get<AdminOrganization[] | { organizations?: AdminOrganization[] }>(
    '/v1/admin/orgs',
    { coreApi: false }
  );
  return Array.isArray(data) ? data : data.organizations ?? [];
}

export async function provisionOrganization(input: ProvisionOrganizationInput): Promise<ProvisionOrganizationResult> {
  return api.post<ProvisionOrganizationResult>('/v1/admin/orgs', input, { coreApi: false });
}

export async function updateAdminOrganization(
  orgId: string,
  input: UpdateAdminOrganizationInput
): Promise<AdminOrganization> {
  return api.put<AdminOrganization>(`/v1/admin/orgs/${encodeURIComponent(orgId)}`, input, { coreApi: false });
}

export async function getAdminBillingConfig(): Promise<AdminBillingConfig> {
  return api.get<AdminBillingConfig>('/v1/billing/config', { coreApi: false });
}

export async function rechargeOrganization(input: RechargeInput): Promise<RechargeResult> {
  return api.post<RechargeResult>('/v1/admin/billing/recharge', input, { coreApi: false });
}

export async function updateAdminBillingConfig(input: UpdateAdminBillingConfigInput): Promise<AdminBillingConfig> {
  return api.put<AdminBillingConfig>('/v1/admin/billing/config', input, { coreApi: false });
}

export async function getOrgBillingPolicy(orgId: string): Promise<OrgBillingPolicy> {
  return api.get<OrgBillingPolicy>(`/v1/admin/billing/orgs/${encodeURIComponent(orgId)}/config`, { coreApi: false });
}

export async function updateOrgBillingPolicy(orgId: string, input: UpdateOrgBillingPolicyInput): Promise<OrgBillingPolicy> {
  return api.put<OrgBillingPolicy>(
    `/v1/admin/billing/orgs/${encodeURIComponent(orgId)}/config`,
    input,
    { coreApi: false }
  );
}
