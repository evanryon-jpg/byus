// Stripe client, shared across the app.
// Uses the secret key from your Stripe Dashboard (test mode key while developing).

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

export default stripe;

// Your platform's take rate, applied to every subscription charge. Every creator starts
// at STANDARD_FEE_PERCENT; once their lifetime gross revenue on ByUs crosses
// FEE_DISCOUNT_THRESHOLD_CENTS, their rate drops permanently to DISCOUNTED_FEE_PERCENT —
// see lib/fees.js for where that crossing is detected (on each successful invoice, in the
// Stripe webhook) and applied (to that creator's stored rate and every one of their live
// Stripe subscriptions). Kept in one place so it's easy to find/change — never hardcode
// these numbers elsewhere in the app.
export const STANDARD_FEE_PERCENT = 10;
export const DISCOUNTED_FEE_PERCENT = 7;
export const FEE_DISCOUNT_THRESHOLD_CENTS = 200000; // $2,000 lifetime gross revenue

// Floor for the platform-wide milestone bonus in lib/fees.js -- a creator's effective
// fee (personal tier minus the platform's current milestone reduction) never drops below
// this, no matter how many milestones ByUs itself has crossed. Set at 6, not lower: Stripe's
// own processing (2.9% + $0.30/charge), Connect active-account fee ($2/mo/creator), and
// payout fee (0.25% + $0.25/payout) all come out of ByUs's side of the split, not the
// creator's -- see lib/fees.js and app/api/subscribe/route.js. Paired with the 4
// platform_milestones rows at $10K/$100K/$500K/$1M (1 point each), this floors every
// creator at exactly 6% once all four are crossed, whether or not they've hit their own
// personal-tier discount (10-4=6, or 7-4=3 clamped up to 6) -- a clean, symmetric floor.
export const MIN_FEE_PERCENT = 6;
