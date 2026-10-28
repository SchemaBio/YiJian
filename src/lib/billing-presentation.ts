import { chineseText, type TextTranslator } from '@/i18n/text';
import type { BillingTransaction } from './billing';

export function billingDisplayType(row: BillingTransaction): string {
  if (row.billing_basis === 'ai_assistance' && row.type === 'pre_deduction') {
    if (row.billing_state === 'settled') return 'deduction';
    if (row.billing_state === 'refunded') return 'reservation_refunded';
  }
  return row.type;
}

export function billingTransactionLabel(row: BillingTransaction, t: TextTranslator = chineseText): string {
  const type = billingDisplayType(row);
  const keys: Record<string, string> = {
    recharge: 'billing.addCreditsfa03c4', pre_deduction: 'settings.reservedCharge813760',
    deduction: 'settings.chargeb04d6f', refund: 'settings.refundb82ef8',
    failure_refund: 'settings.failureRefund390d28', adjust: 'settings.adjustment0a4d26',
    download: 'settings.downloadChargef8580c', settlement: 'settings.settlementConfirmation',
    reservation_refunded: 'settings.reservationRefunded',
    payment_refund: 'stripePayments.refundLedger', payment_dispute: 'stripePayments.disputeLedger', payment_restore: 'stripePayments.restoreLedger',
  };
  return keys[type] ? t(keys[type]) : type || '-';
}

export function billingTransactionDescription(row: BillingTransaction, t: TextTranslator = chineseText): string {
  const generated = /^AI (hpo|acmg|svcv4|cnv_gain|cnv_loss) \u00b7 (reserve|settle|refund)$/.exec(row.description ?? '');
  if (row.billing_basis !== 'ai_assistance' || !generated) return row.description || '-';
  const feature = generated[1].toUpperCase().replace('_', ' ');
  const type = billingDisplayType(row);
  const keys: Record<string, string> = {
    deduction: 'settings.aiChargeDescription', pre_deduction: 'settings.aiReservationDescription',
    settlement: 'settings.aiSettlementDescription', failure_refund: 'settings.aiRefundDescription',
    reservation_refunded: 'settings.aiRefundedReservationDescription',
  };
  return keys[type] ? t(keys[type], {p0: feature}) : row.description || '-';
}
