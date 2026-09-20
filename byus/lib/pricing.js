// ByUs's own business rules — fee tiers, promo limits, tip bounds. None of this is
// Stripe-specific; it used to live in lib/stripe.js only because that was the file
// everything else already imported, not because it has anything to do with the Stripe SDK.
// Moved here as part of introducing lib/payments/ (a generic payment-provider interface,
// currently backed by a single Stripe adapter) so that a file which only cares about these
// numbers — app/api/me, app/api/creator/earnings, app/api/creators — never needs to depend
// on the payments layer at all.

// Your platform's take rate, applied to every subscription charge. Every non-founding
// creator is simply STANDARD_FEE_PERCENT, full stop; founding creators (see
// FOUNDING_CREATOR_LIMIT below) are DISCOUNTED_FEE_PERCENT from day one.
//
// FEE_DISCOUNT_THRESHOLD_CENTS below is currently unused — business decision, 2026-09-19:
// with only a handful of creators on the platform, a second earned-discount tier ($2,000/mo
// in gross revenue drops a standard creator to DISCOUNTED_FEE_PERCENT for the rest of that
// month) added billing complexity nobody was earning enough to reach yet. Paused rather than
// deleted so it's a one-line change in lib/fees.js's recordEarningAndCheckFeeTier to bring
// back once there's real creator volume: re-add the monthToDateCents query and restore
// `founding || monthToDateCents >= FEE_DISCOUNT_THRESHOLD_CENTS` to the targetFeePercent
// ternary there. If it comes back, restore the matching FAQ/Help/Terms/homepage copy too
// (see app/components/faqs-data.js, app/help/data.js, app/terms/page.js, app/page.js) —
// all four were rewritten to describe the current founding-only, flat-13%-otherwise story.
export const STANDARD_FEE_PERCENT = 13;
export const DISCOUNTED_FEE_PERCENT = 10;
export const FEE_DISCOUNT_THRESHOLD_CENTS = 200000; // $2,000 gross revenue in a calendar month — currently unused, see above

// Sustainable floors for new paid checkouts. Existing subscriptions below this amount
// may renew unchanged, but no new supporter can start a below-floor checkout.
export const MIN_MEMBERSHIP_PRICE_CENTS = 500; // $5.00
export const MIN_DIGITAL_PRODUCT_PRICE_CENTS = 500; // $5.00
// Annual plans may discount two months at most (10 monthly payments for 12 months).
export const MIN_ANNUAL_BILLING_MONTHS = 10;

// Floor for the platform-wide milestone bonus in lib/fees.js. Set to match
// DISCOUNTED_FEE_PERCENT exactly: Stripe's own processing (2.9% + $0.30/charge), Connect
// active-account fee ($2/mo/creator), and payout fee (0.25% + $0.25/payout) all come out
// of ByUs's side of the split, not the creator's -- see lib/fees.js and
// app/api/subscribe/route.js -- and 10% is the lowest advertised rate.
// Since the floor now equals the personal-tier rate, getPlatformMilestoneReductionPoints()
// in lib/fees.js always returns 0 -- the platform-wide milestone bonus is retired, and
// platform_milestones now only powers a celebratory "best month so far" stat on the
// homepage gauge, with no effect on anyone's bill. This constant is kept as the hard floor
// in case that ever changes. If a second payment provider is ever added with different fee
// economics, this floor is the first number worth re-checking.
export const MIN_FEE_PERCENT = 10;

// Launch promo: FOUNDING_CREATOR_LIMIT permanent spots shared by waitlist reservations and creator accounts
// get DISCOUNTED_FEE_PERCENT (10%) permanently, from day one -- currently the only way to
// reach that rate at all, since the $2,000/mo earned-discount tier is paused (see above).
// See getFoundingCreatorRank / isFoundingCreator in lib/fees.js for how "first 100" is
// determined (persisted in founding_reservations, claimed by matching email at signup).
export const FOUNDING_CREATOR_LIMIT = 100;

// One-time tips ("buy a coffee") use the same percentage fee as subscriptions. The $5
// floor keeps Stripe's fixed per-transaction cost from consuming the entire ByUs share.
// The ceiling is a sanity bound that catches a mistyped extra digit before checkout.
export const MIN_TIP_CENTS = 500; // $5.00
export const MAX_TIP_CENTS = 50000; // $500.00
