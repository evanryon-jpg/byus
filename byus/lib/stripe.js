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
