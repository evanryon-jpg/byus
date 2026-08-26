// Stripe client, shared across the app.
// Uses the secret key from your Stripe Dashboard (test mode key while developing).

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

export default stripe;

// Your platform's flat take rate, applied to every subscription charge.
// Kept in one place so it's easy to find/change — never hardcode "10" elsewhere in the app.
export const PLATFORM_FEE_PERCENT = 10;
