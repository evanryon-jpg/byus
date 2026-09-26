// Rules for creator-issued discount codes (see app/api/creator/discounts/route.js and
// the "Discount codes" section of app/creator/dashboard/page.js). A code always takes a
// percentage off, never a flat dollar amount -- a flat amount can outlive a price change
// or exceed a cheap tier's price outright; a percentage can't.
//
// MAX_PERCENT_OFF exists for one reason: a subscription can be discounted, but it can
// never be made free. Stripe still takes its own processing cut on whatever is charged,
// and ByUs's application fee is a percentage of that same charge -- a 100%-off code
// would leave nothing for either to take a cut of. Capping below 100 means the deepest a
// code can go is "ByUs waives its own share," never "this creator gives away access for
// nothing."
//
// Tightened Sept 26, 2026, from 90% to 75%, plus a floor on the discounted charge: a 90%
// code on a $10 tier charged the fan $1, and Stripe's 30 cents + 2.9% on $1 is more than
// ByUs's whole fee on it. MIN_FIRST_CHARGE_CENTS keeps the discounted first payment at $4
// or more, which covers card costs at the standard 13% rate (and is within a few cents at
// the founding 10%). So the deepest code depends on the tier's price: 50% on $8, 60% on
// $10, the full 75% from $16 up. See maxDiscountPercentForPrice.
export const MAX_DISCOUNT_PERCENT = 75;
export const MIN_DISCOUNT_PERCENT = 5;
export const MIN_FIRST_CHARGE_CENTS = 400;

// Deepest whole-percent discount a code can take off a monthly price of `priceCents`.
export function maxDiscountPercentForPrice(priceCents) {
  if (!Number.isInteger(priceCents) || priceCents <= MIN_FIRST_CHARGE_CENTS) return 0;
  const byFloor = Math.floor((1 - MIN_FIRST_CHARGE_CENTS / priceCents) * 100);
  return Math.max(0, Math.min(MAX_DISCOUNT_PERCENT, byFloor));
}

// Every coupon this feature creates lasts exactly one invoice ("first month/year off"),
// never a standing discount -- simpler to reason about, and it can't quietly compound
// with the fee-tier or referral discounts across a long subscription lifetime.
export const COUPON_DURATION = 'once';
