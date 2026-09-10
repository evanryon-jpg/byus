// The raw Stripe SDK client. Nothing outside lib/payments/providers/stripe.js should ever
// import this directly — every other file in the app talks to lib/payments (the generic
// provider interface) instead, never to the Stripe SDK itself. Keeping the SDK client
// behind exactly one file is what makes a second provider possible later: the day ByUs
// adds one, it gets its own client file right here alongside this one, and
// lib/payments/index.js picks which adapter is active — no other file changes.

import Stripe from 'stripe';

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

export default stripeClient;
