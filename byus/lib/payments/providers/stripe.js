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
  checkoutDisclosure,
}) {
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    ...(checkoutDisclosure
      ? { custom_text: { submit: { message: checkoutDisclosure } } }
      : {}),
    // Stripe Tax: on these destination charges ByUs (the platform), not the creator, is
    // the merchant of record (see this file's header comment -- on_behalf_of is never
    // set anywhere). automatic_tax[liability][type]=self tells Stripe to calculate tax
    // off ByUs's own tax settings/registrations rather than the connected account's, and
    // subscription_data.invoice_settings.issuer[type]=self keeps renewal invoices issued
    // in ByUs's name to match -- required in jurisdictions (the EU, notably) where the
    // invoice PDF itself is the tax instrument. customer_update lets Checkout save
    // whatever billing name/address it collects back onto the fan's saved Stripe
    // Customer, so later automatic renewals keep calculating tax off a current address
    // too, not just this one session.
    // IMPORTANT: this calculates $0 tax everywhere until ByUs actually has tax
    // registrations on file in the Stripe Dashboard (Tax > Registrations) for the
    // jurisdictions it's required to collect in -- turning this on in code is necessary
    // but not sufficient for real compliance. See TAX_SETUP.md at the repo root.
    automatic_tax: { enabled: true, liability: { type: 'self' } },
    customer_update: { address: 'auto', name: 'auto' },
    subscription_data: {
      application_fee_percent: applicationFeePercent,
      transfer_data: { destination: connectedAccountId },
      invoice_settings: { issuer: { type: 'self' } },
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
  checkoutDisclosure,
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
    ...(checkoutDisclosure
      ? { custom_text: { submit: { message: checkoutDisclosure } } }
      : {}),
    // Stripe Tax -- see the matching comment in createSubscriptionCheckoutSession above
    // for the full reasoning. No invoice_settings/issuer needed here: a one-time
    // Checkout Session in payment mode never generates an Invoice object, so there's no
    // invoice-issuer identity to set. Same $0-until-registered caveat applies.
    automatic_tax: { enabled: true, liability: { type: 'self' } },
    customer_update: { address: 'auto', name: 'auto' },
    payment_intent_data: {
      application_fee_amount: applicationFeeCents,
      transfer_data: { destination: connectedAccountId },
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

// ---- Refunds & connected-account fund recovery ------------------------------------------

export async function createDestinationChargeRefund({
  chargeId,
  amountCents,
  reason = 'requested_by_customer',
  metadata,
  refundApplicationFee = true,
}) {
  const params = {
    charge: chargeId,
    reverse_transfer: true,
    refund_application_fee: refundApplicationFee,
    reason,
    ...(metadata ? { metadata } : {}),
    ...(Number.isInteger(amountCents) ? { amount: amountCents } : {}),
  };

  const refund = await stripe.refunds.create(params);
  return {
    refundId: refund.id,
    status: refund.status,
    amountCents: refund.amount,
    chargeId: typeof refund.charge === 'string' ? refund.charge : refund.charge?.id || chargeId,
    transferReversalId:
      typeof refund.transfer_reversal === 'string'
        ? refund.transfer_reversal
        : refund.transfer_reversal?.id || null,
  };
}

export async function reverseDestinationChargeTransfer({
  chargeId,
  amountCents,
  metadata,
  idempotencyKey,
}) {
  const charge = await stripe.charges.retrieve(chargeId);
  const transferId =
    typeof charge.transfer === 'string' ? charge.transfer : charge.transfer?.id || null;

  if (!transferId) {
    throw new Error(`Charge ${chargeId} does not have a destination transfer to reverse.`);
  }

  const reversal = await stripe.transfers.createReversal(
    transferId,
    {
      ...(Number.isInteger(amountCents) ? { amount: amountCents } : {}),
      ...(metadata ? { metadata } : {}),
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  return {
    reversalId: reversal.id,
    transferId,
    amountCents: reversal.amount,
    currency: reversal.currency,
  };
}

// ---- Discount codes --------------------------------------------------------------------

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

// ---- Customer balance credits ----------------------------------------------------------

export async function applyCustomerBalanceCredit({ customerId, amountCents, description }) {
  await stripe.customers.createBalanceTransaction(customerId, {
    amount: -amountCents,
    currency: 'usd',
    description,
  });
}

// ---- Webhooks --------------------------------------------------------------------------

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

export async function retrieveDispute({ id }) {
  return stripe.disputes.retrieve(id);
}

export async function retrieveInvoice({ id }) {
  return stripe.invoices.retrieve(id);
}
