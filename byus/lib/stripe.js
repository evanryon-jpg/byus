// Stripe client, shared across the app.
// Uses the secret key from your Stripe Dashboard (test mode key while developing).

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

export default stripe;

// Your platform's take rate, applied to every subscription charge. Every creator starts
// at STANDARD_FEE_PERCENT; for any calendar month their gross revenue on ByUs reaches
// FEE_DISCOUNT_THRESHOLD_CENTS, their rate drops to DISCOUNTED_FEE_PERCENT for the rest of
// that month — and moves back to STANDARD_FEE_PERCENT the moment a new month starts without
// crossing it again, so a fee drop always reflects that month's actual volume rather than a
// slow trickle accumulated over a year or more. See lib/fees.js for where that crossing is
// detected (on each successful invoice, in the Stripe webhook) and applied (to that
// creator's stored rate and every one of their live Stripe subscriptions). Kept in one
// place so it's easy to find/change — never hardcode these numbers elsewhere in the app.
export const STANDARD_FEE_PERCENT = 10;
export const DISCOUNTED_FEE_PERCENT = 7;
export const FEE_DISCOUNT_THRESHOLD_CENTS = 200000; // $2,000 gross revenue in a calendar month

// Floor for the platform-wide milestone bonus in lib/fees.js. Set to match
// DISCOUNTED_FEE_PERCENT exactly: Stripe's own processing (2.9% + $0.30/charge), Connect
// active-account fee ($2/mo/creator), and payout fee (0.25% + $0.25/payout) all come out
// of ByUs's side of the split, not the creator's -- see lib/fees.js and
// app/api/subscribe/route.js -- and 7% is the lowest rate that reliably clears that cost.
// Since the floor now equals the personal-tier rate, getPlatformMilestoneReductionPoints()
// in lib/fees.js always returns 0 -- the platform-wide milestone bonus is retired, and
// platform_milestones now only powers a celebratory "best month so far" stat on the
// homepage gauge, with no effect on anyone's bill. This constant is kept as the hard floor
// in case that ever changes.
export const MIN_FEE_PERCENT = 7;
