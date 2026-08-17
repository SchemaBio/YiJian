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
  | string;

export interface BillingTransaction {
  id: number;
  org_id: string;
  amount: number;
  balance_after: number;
  type: BillingTransactionType;
  reference_id?: string;
  description?: string;
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

export function calculateEstimatedCredits(minutes: number, config: BillingConfig | null): number | null {
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
  const taskTransactions = transactions.filter((transaction) => transaction.reference_id === taskId);
  let deducted = 0;
  let preDeducted = 0;
  let refunded = 0;

  for (const transaction of taskTransactions) {
    if (transaction.type === 'pre_deduction' && transaction.amount < 0) {
      preDeducted += -transaction.amount;
      deducted += -transaction.amount;
    } else if (transaction.type === 'deduction' && transaction.amount < 0) {
      deducted += -transaction.amount;
    } else if ((transaction.type === 'refund' || transaction.type === 'failure_refund') && transaction.amount > 0) {
      refunded += transaction.amount;
    }
  }

  return {
    taskId,
    preDeducted,
    deducted,
    refunded,
    netCost: Math.max(0, deducted - refunded),
    transactionCount: taskTransactions.length,
    lastTransactionAt: taskTransactions[0]?.created_at,
  };
}

export function taskBillingMap(
  taskIds: string[],
  transactions: BillingTransaction[]
): Record<string, TaskBillingSummary> {
  return Object.fromEntries(taskIds.map((taskId) => [taskId, summarizeTaskBilling(taskId, transactions)]));
}

export async function getBillingBalance(): Promise<BillingBalance> {
  return api.get<BillingBalance>('/v1/billing/balance', { coreApi: false });
}

export async function getBillingConfig(): Promise<BillingConfig> {
  return api.get<BillingConfig>('/v1/billing/config', { coreApi: false });
}

export async function getBillingTransactions(page = 1, pageSize = 20): Promise<BillingTransactionPage> {
  return api.get<BillingTransactionPage>('/v1/billing/transactions', {
    coreApi: false,
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
