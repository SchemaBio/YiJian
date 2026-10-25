import { describe, expect, it } from 'vitest';
import { billingDisplayType, billingTransactionLabel, billingTransactionDescription } from './billing-presentation';
import { createTextTranslator } from '@/i18n/text';
import { locales } from '@/i18n/locales';
import type { BillingTransaction } from './billing';

const reservation: BillingTransaction = {id: 23, org_id: 'org', amount: -1, balance_after: 9,
 type: 'pre_deduction', reference_id: 'ai:request', billing_basis: 'ai_assistance',
 description: 'AI hpo · reserve', created_by: 1, created_at: '2026-10-25T09:18:02Z'};

describe('AI credit ledger presentation', () => {
 it('shows a settled reservation as a charge even when the settlement is on another page', () => {
  const row = {...reservation, billing_state: 'settled' as const};
  expect(billingDisplayType(row)).toBe('deduction');
  expect(billingTransactionLabel(row)).toBe('扣费');
  expect(billingTransactionDescription(row)).toBe('HPO AI 辅助生成扣费');
  expect(row.type).toBe('pre_deduction');
  expect(row.amount).toBe(-1);
 });
 it('keeps pending reservations and refunded reservations distinct', () => {
  expect(billingDisplayType({...reservation, billing_state: 'reserved'})).toBe('pre_deduction');
  const refunded = {...reservation, billing_state: 'refunded' as const};
  expect(billingDisplayType(refunded)).toBe('reservation_refunded');
  expect(billingTransactionLabel(refunded)).toBe('预扣已退回');
  expect(billingDisplayType(reservation)).toBe('pre_deduction');
 });
 it('labels the zero-value settlement as confirmation without a second charge', () => {
  const row = {...reservation, type: 'settlement', amount: 0, description: 'AI hpo · settle', billing_state: 'settled' as const};
  expect(billingTransactionLabel(row)).toBe('结算确认');
  expect(billingTransactionDescription(row)).toBe('HPO AI 辅助生成已结算，无额外扣费');
  expect(reservation.amount + row.amount).toBe(-1);
 });
 it('preserves unrelated entries and custom descriptions', () => {
  const task = {...reservation, billing_basis: 'task_estimate', billing_state: 'settled' as const, description: 'User description'};
  expect(billingDisplayType(task)).toBe('pre_deduction');
  expect(billingTransactionDescription(task)).toBe('User description');
 });
 it.each(locales)('localizes settlement and AI charge descriptions in %s', locale => {
  const t = createTextTranslator(locale);
  expect(billingTransactionLabel({...reservation, type:'settlement'}, t)).not.toBe('settlement');
  expect(billingTransactionDescription({...reservation, billing_state:'settled'}, t)).not.toContain('reserve');
 });
});
