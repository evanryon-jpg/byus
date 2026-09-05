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
export const MAX_DISCOUNT_PERCENT = 90;
export const MIN_DISCOUNT_PERCENT = 5;

// Every coupon this feature creates lasts exactly one invoice ("first month/year off"),
// never a standing discount -- simpler to reason about, and it can't quietly compound
// with the fee-tier or referral discounts across a long subscription lifetime.
export const COUPON_DURATION = 'once';
