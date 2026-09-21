// How each Stripe balance-transaction type rolls up into ByUs's accounting lines.
//
// With ByUs's destination charges, one fan payment moves the platform balance several
// times: the charge (+gross, with Stripe's fee), the transfer to the creator (-), and --
// depending on how Stripe settles the application fee -- an application_fee (+) row.
// Adding every bucket except payouts therefore always equals the cash ByUs actually kept,
// whichever way the fee is represented. That identity is what the reports rely on.

export const BUCKETS = [
  'sales',             // fan payments (gross, including any sales tax collected)
  'refunds',           // refunds back to fans
  'disputes',          // chargebacks and chargeback reversals
  'creator_transfers', // money sent to creators' Stripe accounts (and reversals of it)
  'platform_fees',     // explicit application-fee rows, if Stripe creates them
  'stripe_fees',       // standalone Stripe charges (Billing, Tax, FX, Connect fees...)
  'payouts',           // ByUs balance paid out to ByUs's own bank
  'other',             // adjustments, reserves, anything unexpected
];

const TYPE_TO_BUCKET = {
  charge: 'sales',
  payment: 'sales',
  refund: 'refunds',
  payment_refund: 'refunds',
  refund_failure: 'refunds',
  payment_failure_refund: 'refunds',
  payment_reversal: 'refunds',
  transfer: 'creator_transfers',
  transfer_refund: 'creator_transfers',
  transfer_cancel: 'creator_transfers',
  transfer_failure: 'creator_transfers',
  connect_collection_transfer: 'creator_transfers',
  application_fee: 'platform_fees',
  application_fee_refund: 'platform_fees',
  stripe_fee: 'stripe_fees',
  stripe_fx_fee: 'stripe_fees',
  tax_fee: 'stripe_fees',
  payout: 'payouts',
  payout_cancel: 'payouts',
  payout_failure: 'payouts',
  payout_minimum_balance_hold: 'payouts',
  payout_minimum_balance_release: 'payouts',
};

export function bucketFor(type, reportingCategory) {
  if (type === 'adjustment' && /dispute/.test(reportingCategory || '')) return 'disputes';
  return TYPE_TO_BUCKET[type] || 'other';
}

export const BUCKET_LABELS = {
  sales: 'Fan payments',
  refunds: 'Refunds',
  disputes: 'Disputes',
  creator_transfers: 'Paid to creators',
  platform_fees: 'Application fees',
  stripe_fees: 'Stripe service fees',
  payouts: 'Payouts to ByUs bank',
  other: 'Other adjustments',
};

export const KIND_LABELS = {
  subscription: 'Membership',
  tip: 'Tip',
  product: 'Digital product',
  other: 'Other',
};
