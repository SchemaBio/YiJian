import { api } from './api';

export interface BillingBalance {
  org_id: string;
  balance: number;
}

export type BillingTransactionType = 'recharge' | 'deduction' | 'refund' | 'adjust' | 'download' | string;

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
  min_balance: number;
}

export interface BillingTransactionPage {
  items: BillingTransaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
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
