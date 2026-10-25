import { api } from './api';

export interface BillingBalance {
  org_id: string;
  balance: number;
}

export type BillingTransactionType =
  | 'recharge'
  | 'pre_deduction'
  | 'deduction'
  | 'refund'
  | 'failure_refund'
  | 'adjust'
  | 'download'
  | 'settlement'
  | string;

export interface BillingTransaction {
  id: number;
  org_id: string;
  amount: number;
  balance_after: number;
  type: BillingTransactionType;
  reference_id?: string;
  related_task_id?: string;
  description?: string;
  billing_basis?: string;
  billing_state?: 'reserved' | 'settled' | 'refunded';
  created_by: number;
  created_at: string;
}

export interface BillingConfig {
  credits_per_minute: number;
  credit_rate_multiplier: number;
  download_credits: number;
  cnv_baseline_credits_per_gib?: number;
  min_balance: number;
}

export interface BillingTransactionPage {
  items: BillingTransaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TaskBillingSummary {
  taskId: string;
  preDeducted: number;
  deducted: number;
  refunded: number;
  netCost: number;
  transactionCount: number;
  lastTransactionAt?: string;
}

export const BILLING_UPDATED_EVENT = 'schema:billing-updated';

export function notifyBillingUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BILLING_UPDATED_EVENT));
  }
}

export function calculateEstimatedCredits(minutes: number, config: BillingConfig | null, template?: string): number | null {
  if (template === 'vcf2anno') return 50;
  if (!config) return null;
  const normalizedMinutes = Math.max(1, Math.trunc(minutes) || 1);
  const calculated = Math.round(
    normalizedMinutes * config.credits_per_minute * config.credit_rate_multiplier
  );
  return calculated > 0 ? calculated : config.credits_per_minute;
}

export function summarizeTaskBilling(
  taskId: string,
  transactions: BillingTransaction[]
): TaskBillingSummary {
  const attemptPrefix = `${taskId}:`;
  const taskTransactions = transactions.filter((transaction) => (
    transaction.reference_id === taskId
    || transaction.reference_id?.startsWith(attemptPrefix)
  ));
  // Settling a reservation can change its type to deduction. Select the
  // latest initial charge, never a late refund from a previous attempt.
  const charges = taskTransactions.filter(row => row.amount < 0 && ['pre_deduction', 'deduction'].includes(row.type))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const latest = charges.find(row => row.billing_basis !== 'task_settlement') ?? charges[0];
  const current = latest ? taskTransactions.filter(row => row.reference_id === latest.reference_id) : [];
  let deducted = 0;
  let preDeducted = 0;
  let refunded = 0;

  for (const transaction of current) {
    if (transaction.type === 'pre_deduction' && transaction.amount < 0) {
      deducted += -transaction.amount;
    } else if (transaction.type === 'deduction' && transaction.amount < 0) {
      deducted += -transaction.amount;
    } else if ((transaction.type === 'refund' || transaction.type === 'failure_refund') && transaction.amount > 0) {
      refunded += transaction.amount;
    }
  }

  // Task cards describe one attempt; the billing ledger retains all attempts.
  const settled = current.some((row) => (
    row.type === 'failure_refund' || row.type === 'refund'
    || row.type === 'settlement' || row.billing_basis === 'task_settlement'
  ));
  if (!settled) {
    preDeducted = current.reduce((sum, row) => (
      row.type === 'pre_deduction' && row.amount < 0 ? sum - row.amount : sum
    ), 0);
  }

  return {
    taskId,
    preDeducted,
    deducted,
    refunded,
    netCost: Math.max(0, deducted - refunded),
    transactionCount: current.length,
    lastTransactionAt: current.reduce<string | undefined>((latest, transaction) => (
      !latest || transaction.created_at > latest ? transaction.created_at : latest
    ), undefined),
  };
}

export function billingReferenceTaskId(referenceId: string): string {
  return referenceId.split(':', 1)[0];
}

export function taskBillingMap(
  taskIds: string[],
  transactions: BillingTransaction[]
): Record<string, TaskBillingSummary> {
  return Object.fromEntries(taskIds.map((taskId) => [taskId, summarizeTaskBilling(taskId, transactions)]));
}

export async function getBillingBalance(): Promise<BillingBalance> {
  return api.get<BillingBalance>('/v1/billing/balance', { coreApi: false, cache: 'no-store' });
}

export async function getBillingConfig(): Promise<BillingConfig> {
  // Billing policy can be changed by Cuttlefish while this tab is open. Do
  // not let the browser HTTP cache keep showing the previous organization
  // multiplier after a refresh or a route transition.
  return api.get<BillingConfig>('/v1/billing/effective-config', { coreApi: false, cache: 'no-store' });
}

export async function getBillingTransactions(page = 1, pageSize = 20): Promise<BillingTransactionPage> {
  return api.get<BillingTransactionPage>('/v1/billing/transactions', {
    coreApi: false,
    cache: 'no-store',
    params: {
      page: String(page),
      page_size: String(pageSize),
    },
  });
}

export async function getRecentTaskBilling(taskIds: string[]): Promise<Record<string, TaskBillingSummary>> {
  if (taskIds.length === 0) return {};
  const response = await getBillingTransactions(1, 100);
  return taskBillingMap(taskIds, response.items ?? []);
}

export async function getTaskBilling(taskId: string): Promise<TaskBillingSummary> {
  const firstPage = await getBillingTransactions(1, 100);
  const transactions = [...(firstPage.items ?? [])];
  const totalPages = Math.max(1, firstPage.total_pages ?? Math.ceil((firstPage.total ?? 0) / 100));

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await getBillingTransactions(page, 100);
    transactions.push(...(response.items ?? []));
  }

  return summarizeTaskBilling(taskId, transactions);
}
