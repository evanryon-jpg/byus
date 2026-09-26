// Backward-compatible shim. This file used to hold the Stripe client and ByUs's own pricing
// constants together; both have moved (client -> lib/payments/stripe-client.js, behind the
// lib/payments/ provider interface; constants -> lib/pricing.js, since they're business rules,
// not Stripe specifics). Nothing new should import from here — import { paymentProvider }
// from '@/lib/payments' for provider calls, or the specific constant from '@/lib/pricing'.
// Kept only so any caller not yet migrated keeps working unchanged.

import stripeClient from './payments/stripe-client';

export default stripeClient;

export {
  STANDARD_FEE_PERCENT,
  DISCOUNTED_FEE_PERCENT,
  FEE_DISCOUNT_THRESHOLD_CENTS,
  MIN_FEE_PERCENT,
  FOUNDING_CREATOR_LIMIT,
  MIN_TIP_CENTS,
  MAX_TIP_CENTS,
} from './pricing';
