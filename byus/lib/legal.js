// Version identifiers stored with Stripe purchase metadata so a later dispute can prove
// which terms/refund disclosure applied to the transaction. Bump these whenever the
// corresponding language materially changes.
export const TERMS_VERSION = '2026-09-12';
export const MEMBERSHIP_REFUND_POLICY_VERSION = '2026-09-12';
export const TIP_REFUND_POLICY_VERSION = '2026-09-12';

export function membershipCheckoutDisclosure({ amountCents, interval, trialDays = 0 }) {
  const amount = `$${(amountCents / 100).toFixed(2)}`;
  const cadence = interval === 'year' ? 'year' : 'month';
  const trialPrefix = Number.isInteger(trialDays) && trialDays > 0
    ? `After your ${trialDays}-day free trial, `
    : '';

  return `${trialPrefix}${amount}/${cadence}, renewing automatically until canceled. Cancel anytime. Previous membership payments are generally non-refundable except where required by law or when ByUs determines a refund is appropriate.`;
}

export function tipCheckoutDisclosure() {
  return 'This is a one-time tip, not a subscription. Tips are generally non-refundable except where required by law or when ByUs determines a refund is appropriate.';
}
