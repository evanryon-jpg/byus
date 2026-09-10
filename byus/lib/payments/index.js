// The single switch point for which payment provider is active. Every caller in the app
// imports `paymentProvider` from here — never a provider adapter file directly, and never
// the raw Stripe SDK. Today this always resolves to the Stripe adapter
// (lib/payments/providers/stripe.js); the day ByUs adds a second processor, that adapter
// gets its own file in lib/payments/providers/, and this file becomes the one place that
// decides which adapter is active (globally, or per creator — whichever the real need turns
// out to be). No caller elsewhere in the app should need to change when that happens.
//
// See lib/payments/providers/stripe.js's own header comment for the three places this
// interface is deliberately NOT fully generic yet (webhook shapes, discount-code storage,
// connected-account onboarding shape) — read that before adding a second provider.

import * as stripeProvider from './providers/stripe';

export const paymentProvider = stripeProvider;
