import { describe, expect, it } from 'vitest';
import { summarizeTaskBilling, type BillingTransaction } from './billing';

function row(id: number, type: string, amount: number, attempt: string, billing_basis?: string): BillingTransaction {
  return { id, type, amount, reference_id: `task:${attempt}`, org_id: 'org', balance_after: 0,
    created_by: 1, created_at: `2026-10-09T00:00:0${id}Z`, billing_basis };
}

describe('task reservations across retries', () => {
  it('shows only the retry reservation while preserving historical totals', () => {
    const summary = summarizeTaskBilling('task', [row(3, 'pre_deduction', -77, 'new'),
      row(2, 'failure_refund', 77, 'old'), row(1, 'pre_deduction', -77, 'old')]);
    expect(summary).toMatchObject({ preDeducted: 77, deducted: 154, refunded: 77, netCost: 77 });
  });
  it('does not show a reservation after a full failure refund', () => {
    expect(summarizeTaskBilling('task', [row(1, 'pre_deduction', -77, 'old'),
      row(2, 'failure_refund', 77, 'old')])).toMatchObject({ preDeducted: 0, netCost: 0 });
  });
  it('does not confuse an old delayed refund with the current attempt', () => {
    expect(summarizeTaskBilling('task', [row(1, 'pre_deduction', -77, 'old'),
      row(2, 'pre_deduction', -77, 'new'), row(3, 'failure_refund', 77, 'old')]).preDeducted).toBe(77);
  });
  it.each([
    [row(2, 'refund', 37, 'old'), 40],
    [row(2, 'settlement', 0, 'old'), 77],
    [row(2, 'deduction', -23, 'old', 'task_settlement'), 100],
  ])('clears the reservation on terminal settlement', (settlement, netCost) => {
    expect(summarizeTaskBilling('task', [row(1, 'pre_deduction', -77, 'old'), settlement]))
      .toMatchObject({ preDeducted: 0, netCost });
  });
});
