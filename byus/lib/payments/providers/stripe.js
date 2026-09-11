// The Stripe adapter — every Stripe SDK call in the app lives here and nowhere else. This
// file is what lib/payments/index.js currently exports as `paymentProvider`. If ByUs ever
// adds a second processor, that provider gets its own file in this same directory
// implementing the same method names, and lib/payments/index.js is the one place that
// switches which adapter is active (per creator, or platform-wide — whichever the future
// need turns out to be). No caller anywhere else in the app should need to change.
//
// Scope and honest limits of this abstraction (read before extending it):
//
// 1. Checkout/webhook payload shapes are NOT normalized. `createSubscriptionCheckoutSession`
//    and `createOneTimePaymentCheckoutSession` return a plain `{ url }` (already
//    provider-agnostic), but `retrieveSubscription`, `retrievePaymentIntent`,
//    `retrieveCharge`, `retrieveInvoice`, and the object `verifyWebhookSignature` returns
//    are all still raw Stripe objects. Building a truly generic "canonical event" shape
//    without knowing what a second provider's events actually look like would be guessing —
//    likely wrong guessing. The webhook routes (app/api/webhooks/stripe/route.js and
//    .../stripe-connect/route.js) still switch on Stripe's own event-type strings and read
//    Stripe's own object shapes. A second provider would need its own webhook route(s), not
//    a shared one — that's a real, deliberate boundary, not an oversight.
//
// 2. Discount codes have no local database table — each Stripe Coupon is tagged with
//    metadata.creator_id at creation time and that metadata IS the record (see
//    app/api/creator/discounts/route.js's own header comment). listPromotionCodes /
//    getPromotionCode below unwrap that Stripe-specific shape into a normalized
//    { id, code, active, percentOff, productId, creatorId, ... } object so callers never see
//    Stripe's nesting directly, but the underlying storage is still Stripe itself. A second
//    provider would either need an equivalent "arbitrary metadata on a discount object"
//    concept, or discount codes would need to move into a real local table first — whichever
//    comes up, that's a separate decision from this refactor, not a hidden gap in it.
//
// 3. Connected-account creation (`createConnectedAccount`) hardcodes Stripe Express +
//    card_payments/transfers capabilities — the one shape ByUs actually uses. A second
//    provider's equivalent (a sub-merchant/payee account) will almost certainly have a
//    different onboarding shape entirely; this method's signature is deliberately minimal
//    (just email in, accountId out) so that's someone else's adapter's problem to solve
//    inside its own file, not something this interface tries to anticipate today.

import stripe from '../stripe-client';

// ---- Customers -------------------------------------------------------------------------

export async function createCustomer({ email, userId }) {
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });
  return { customerId: customer.id };
}

// ---- Connected accounts (creator payout destinations) ----------------------------------

// `url` is the creator's own public ByUs page (e.g. https://byusapp.com/creator/<slug-or-id>) —
// passed as business_profile.url so Stripe's own risk/review tooling can see, per connected
// account, the actual storefront that account is selling through. Required, not optional:
// every creator has a page (even pre-slug, the UUID-based URL is permanent — see
// app/api/creators/[creatorId]/route.js), so there's never a real case for omitting it.
export async function createConnectedAccount({ email, url }) {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: { url },
  });
  return { accountId: account.id };
}

export async function createAccountOnboardingLink({ accountId, refreshUrl, returnUrl }) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return { url: accountLink.url };
}

// ---- Products & prices (subscription tiers) ---------------------------------------------

export async function createProduct({ name }) {
  const product = await stripe.products.create({ name });
  return { productId: product.id };
}

export async function updateProductName({ productId, name }) {
  await stripe.products.update(productId, { name });
}

// interval: 'month' | 'year'
export async function createRecurringPrice({ productId, amountCents, interval }) {
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: 'usd',
    recurring: { interval },
  });
  return { priceId: price.id };
}

// ---- Checkout -----------------------------------------------------------------------------

// `discounts` (when present) is already provider-shaped — Stripe's own `[{ coupon: id }]` —
// passed straight through from lib/referrals.js's getReferralDiscount(). That's the one
// place this adapter's boundary leaks slightly; see limit #2 in the file header.
export async function createSubscriptionCheckoutSession({
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  applicationFeePercent,
  connectedAccountId,
  trialDays,
  discounts,
  metadata,
}) {
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    subscription_data: {
      application_fee_percent: applicationFeePercent,
      transfer_data: {
        destination: connectedAccountId,
      },
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      metadata,
    },
  });
  return { url: checkoutSession.url };
}

export async function createOneTimePaymentCheckoutSession({
  customerId,
  amountCents,
  productName,
  applicationFeeCents,
  connectedAccountId,
  successUrl,
  cancelUrl,
  metadata,
}) {
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: productName },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: connectedAccountId,
      },
      metadata,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return { url: checkoutSession.url };
}

export async function createBillingPortalSession({ customerId, returnUrl }) {
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: portalSession.url };
}

// ---- Subscriptions --------------------------------------------------------------------

export async function updateSubscriptionFeePercent({ subscriptionId, feePercent }) {
  await stripe.subscriptions.update(subscriptionId, { application_fee_percent: feePercent });
}

// ---- Discount codes (see limit #2 above — Stripe's metadata is the actual storage) -----

// Retrieve-or-create by a fixed, well-known id — used for the single shared referral
// coupon (see lib/referrals.js). Distinct from createDiscountCoupon below, which always
// mints a fresh coupon for a creator's own discount code.
export async function getOrCreateNamedCoupon({ id, name, percentOff, duration }) {
  try {
    await stripe.coupons.retrieve(id);
  } catch (err) {
    if (err?.code !== 'resource_missing') throw err;
    await stripe.coupons.create({ id, name, percent_off: percentOff, duration });
  }
  return { couponId: id };
}

export async function createDiscountCoupon({ percentOff, duration, productId, creatorId, tierId }) {
  const coupon = await stripe.coupons.create({
    percent_off: percentOff,
    duration,
    ...(productId ? { applies_to: { products: [productId] } } : {}),
    metadata: { creator_id: creatorId, tier_id: tierId || 'all' },
  });
  return { couponId: coupon.id, percentOff: coupon.percent_off };
}

export async function createPromotionCode({ couponId, code, maxRedemptions }) {
  const promotionCode = await stripe.promotionCodes.create({
    coupon: couponId,
    ...(code ? { code } : {}),
    ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
  });
  return {
    id: promotionCode.id,
    code: promotionCode.code,
    active: promotionCode.active,
    timesRedeemed: promotionCode.times_redeemed,
    maxRedemptions: promotionCode.max_redemptions,
  };
}

// Normalized: unwraps Stripe's nested coupon/applies_to shape so callers never see it
// directly. `creatorId`/`productId` come straight off the coupon's own metadata/applies_to —
// this is the one place in the app that reads that Stripe-specific storage.
export async function listPromotionCodes({ limit }) {
  const list = await stripe.promotionCodes.list({ limit });
  return list.data.map((pc) => ({
    id: pc.id,
    code: pc.code,
    active: pc.active,
    percentOff: pc.coupon?.percent_off ?? null,
    productId: pc.coupon?.applies_to?.products?.[0] || null,
    creatorId: pc.coupon?.metadata?.creator_id || null,
    timesRedeemed: pc.times_redeemed,
    maxRedemptions: pc.max_redemptions,
  }));
}

export async function getPromotionCode({ id }) {
  const promotionCode = await stripe.promotionCodes.retrieve(id);
  return {
    id: promotionCode.id,
    active: promotionCode.active,
    creatorId: promotionCode.coupon?.metadata?.creator_id || null,
  };
}

export async function deactivatePromotionCode({ id }) {
  const updated = await stripe.promotionCodes.update(id, { active: false });
  return { id: updated.id, active: updated.active };
}

// ---- Customer balance credits (referral rewards) ----------------------------------------

export async function applyCustomerBalanceCredit({ customerId, amountCents, description }) {
  // A negative amount is a credit — it reduces what the customer owes on their next
  // invoice rather than charging them.
  await stripe.customers.createBalanceTransaction(customerId, {
    amount: -amountCents,
    currency: 'usd',
    description,
  });
}

// ---- Webhooks (raw provider-native objects — see limit #1 above) -----------------------

export function verifyWebhookSignature({ payload, signature, secret }) {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export async function retrieveSubscription({ subscriptionId }) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function retrievePaymentIntent({ id }) {
  return stripe.paymentIntents.retrieve(id);
}

export async function retrieveCharge({ id }) {
  return stripe.charges.retrieve(id);
}

export async function retrieveInvoice({ id }) {
  return stripe.invoices.retrieve(id);
}
