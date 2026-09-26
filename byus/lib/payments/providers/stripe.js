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

// Creators are paid out weekly, every Monday (decided Sept 25, 2026). Their share still lands
// in their own Stripe balance the moment a fan pays -- this only sets how often Stripe sweeps
// that balance to their bank. ByUs pays Stripe 0.25% + 25 cents per payout, so daily payouts
// made small creators cost more than their fees brought in. Stated up front in the FAQ.
export const CREATOR_PAYOUT_SCHEDULE = { interval: 'weekly', weekly_anchor: 'monday' };

export async function createConnectedAccount({ email, url }) {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: { url },
    settings: { payouts: { schedule: CREATOR_PAYOUT_SCHEDULE } },
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

// Tax is added on top of the creator's price, never taken out of it (decided Sept 26,
// 2026): a $10 membership is $10 to a US fan and $10 + VAT to a UK/EU fan, so the price a
// creator sets is always the amount their cut is worked out from. 'exclusive' tells Stripe
// Tax to add the tax as a separate line at checkout. The collected tax itself is pulled
// back from the creator's transfer by withholdTaxFromDestinationCharge below.
export const PRICE_TAX_BEHAVIOR = 'exclusive';

export async function createRecurringPrice({ productId, amountCents, interval }) {
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: 'usd',
    recurring: { interval },
    tax_behavior: PRICE_TAX_BEHAVIOR,
  });
  return { priceId: price.id };
}

// Tier prices created before Sept 26, 2026 have no tax behavior set ('unspecified'), which
// Stripe treats per the Dashboard default. Stripe allows setting it once on an existing
// price, so each old price is switched to exclusive the first time a fan checks out on it.
// Remembered per server instance so it's one extra Stripe call per price, not per checkout.
// Never blocks a checkout: with no tax registrations yet, the setting changes nothing.
const pricesKnownExclusive = new Set();

async function ensurePriceTaxExclusive(priceId) {
  if (!priceId || pricesKnownExclusive.has(priceId)) return;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.tax_behavior || price.tax_behavior === 'unspecified') {
      await stripe.prices.update(priceId, { tax_behavior: PRICE_TAX_BEHAVIOR });
    }
    pricesKnownExclusive.add(priceId);
  } catch (err) {
    console.error(`Could not set tax behavior on price ${priceId} (checkout continues):`, err.message);
  }
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
  trialEnd,
  discounts,
  metadata,
  checkoutDisclosure,
}) {
  await ensurePriceTaxExclusive(priceId);
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
      // trialEnd (unix seconds) is a switching link's first charge date (lib/switch-links.js);
      // it takes the place of the tier's own trial, since Stripe allows one or the other.
      ...(trialEnd
        ? { trial_end: trialEnd }
        : trialDays > 0 ? { trial_period_days: trialDays } : {}),
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
          tax_behavior: PRICE_TAX_BEHAVIOR,
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

// Suspending a creator (app/api/admin/users/[id]/route.js) pauses billing on every one
// of their active subscriptions rather than canceling them outright -- cancellation is
// permanent and throws away the fan's billing relationship even if the suspension turns
// out to be temporary or contested. `behavior: 'void'` means Stripe still advances the
// billing period and generates invoices on schedule, it just voids each one instead of
// charging it, so nothing is ever collected while paused and nothing is left half-billed
// to clean up on reinstatement.
export async function pauseSubscriptionCollection({ subscriptionId }) {
  await stripe.subscriptions.update(subscriptionId, { pause_collection: { behavior: 'void' } });
}

// Per Stripe's docs, an empty value unsets a param -- there's no dedicated "clear" call,
// this *is* the documented way to remove pause_collection and let billing resume on the
// subscription's normal schedule.
export async function resumeSubscriptionCollection({ subscriptionId }) {
  await stripe.subscriptions.update(subscriptionId, { pause_collection: '' });
}

// ---- Connected-account payouts -----------------------------------------------------

// Suspending a creator also pauses payouts from their Connect account: switching to a
// manual schedule stops Stripe from automatically sending their available balance to
// their bank, without touching the account itself (no capability changes, nothing
// disconnected) -- reversible the moment the suspension is lifted, and funds already
// held keep accumulating rather than being seized or returned.
export async function pauseConnectedAccountPayouts({ accountId }) {
  await stripe.accounts.update(accountId, { settings: { payouts: { schedule: { interval: 'manual' } } } });
}

// Restores ByUs's standard payout cadence (weekly, Mondays -- CREATOR_PAYOUT_SCHEDULE above)
// after a suspension is lifted.
export async function resumeConnectedAccountPayouts({ accountId }) {
  await stripe.accounts.update(accountId, { settings: { payouts: { schedule: CREATOR_PAYOUT_SCHEDULE } } });
}

// ---- Refunds & connected-account fund recovery ------------------------------------------

// Refunds pull the creator's share back with Stripe's reverse_transfer, which reverses the
// transfer in proportion to the refund. That assumes the transfer is still whole. When part
// of it was already reversed (the sales tax/VAT ByUs withheld, see
// withholdTaxFromDestinationCharge), Stripe's proportional amount can exceed what's left,
// so for those charges the same proportion is applied to the remaining transfer by hand.
export async function createDestinationChargeRefund({
  chargeId,
  amountCents,
  reason = 'requested_by_customer',
  metadata,
  refundApplicationFee = true,
}) {
  const charge = await stripe.charges.retrieve(chargeId, { expand: ['transfer'] });
  const transfer = typeof charge.transfer === 'object' ? charge.transfer : null;
  const partlyReversed = Boolean(transfer && transfer.amount_reversed > 0);

  const params = {
    charge: chargeId,
    reverse_transfer: !partlyReversed,
    refund_application_fee: refundApplicationFee,
    reason,
    ...(metadata ? { metadata } : {}),
    ...(Number.isInteger(amountCents) ? { amount: amountCents } : {}),
  };

  const refund = await stripe.refunds.create(params);

  let transferReversalId =
    typeof refund.transfer_reversal === 'string'
      ? refund.transfer_reversal
      : refund.transfer_reversal?.id || null;

  if (partlyReversed) {
    const unrefundedBefore = charge.amount - (charge.amount_refunded || 0);
    const remainingTransfer = transfer.amount - transfer.amount_reversed;
    const share = unrefundedBefore > 0 ? refund.amount / unrefundedBefore : 1;
    const reverseCents = Math.min(remainingTransfer, Math.round(remainingTransfer * share));
    if (reverseCents > 0) {
      const reversal = await stripe.transfers.createReversal(
        transfer.id,
        { amount: reverseCents, metadata: { byus_purpose: 'refund', refund_id: refund.id } },
        { idempotencyKey: `byus-refund-reversal-${refund.id}` }
      );
      transferReversalId = reversal.id;
    }
  }

  return {
    refundId: refund.id,
    status: refund.status,
    amountCents: refund.amount,
    chargeId: typeof refund.charge === 'string' ? refund.charge : refund.charge?.id || chargeId,
    transferReversalId,
  };
}

// ---- Sales tax / VAT withholding ---------------------------------------------------------
//
// ByUs is the seller of record on every fan payment (destination charges, no on_behalf_of),
// so ByUs owes any sales tax/VAT Stripe Tax adds. But a destination charge transfers the
// whole charge, tax included, to the creator's account, and a subscription's
// application_fee_percent is taken from the invoice total, tax included. Stripe's own
// "Tax for marketplaces" guide says the platform has to withhold the tax itself; for
// Checkout it recommends a transfer reversal once the payment succeeds, which is this.
//
// The reversal leaves the creator with exactly what they'd have kept with no tax at all:
// (price - ByUs's fee on the price). Worked through for a $10 UK membership at 10%:
//   fan pays $12 ($10 + $2 VAT); Stripe transfers $12 and takes a $1.20 fee (10% of $12)
//   creator would be left with $10.80; the target is $9.00 ($10 - $1.00)
//   so $1.80 is reversed. ByUs ends with $1.20 + $1.80 = $3.00 = its $1 fee + the $2 VAT.
//
// feeIncludesTax: true for subscription invoices (percent of the total, tax included);
// false for one-time Checkout payments, whose application_fee_amount is set in cents on
// the pre-tax price. Safe to call more than once for the same charge: a reversal already
// tagged byus_purpose=tax_withholding on the transfer makes it a no-op.
export const TAX_WITHHOLDING_PURPOSE = 'tax_withholding';

export async function withholdTaxFromDestinationCharge({ chargeId, taxCents, feeIncludesTax }) {
  if (!chargeId || !(taxCents > 0)) return null;

  const charge = await stripe.charges.retrieve(chargeId, { expand: ['transfer'] });
  const transfer = typeof charge.transfer === 'object' ? charge.transfer : null;
  if (!transfer) {
    throw new Error(`Charge ${chargeId} collected ${taxCents} cents of tax but has no creator transfer to withhold it from.`);
  }

  let already = (transfer.reversals?.data || []).some(
    (r) => r.metadata?.byus_purpose === TAX_WITHHOLDING_PURPOSE
  );
  if (!already && transfer.reversals?.has_more) {
    for await (const r of stripe.transfers.listReversals(transfer.id, { limit: 100 })) {
      if (r.metadata?.byus_purpose === TAX_WITHHOLDING_PURPOSE) { already = true; break; }
    }
  }
  if (already) return { alreadyWithheld: true };

  const feeCharged = charge.application_fee_amount || 0;
  const preTaxCents = charge.amount - taxCents;
  const feeOnPreTax = feeIncludesTax && charge.amount > 0
    ? Math.round((feeCharged * preTaxCents) / charge.amount)
    : feeCharged;
  const creatorNow = transfer.amount - feeCharged;
  const creatorTarget = preTaxCents - feeOnPreTax;
  const reverseCents = Math.min(creatorNow - creatorTarget, transfer.amount - transfer.amount_reversed);
  if (reverseCents <= 0) return null;

  const reversal = await stripe.transfers.createReversal(
    transfer.id,
    {
      amount: reverseCents,
      description: 'Sales tax/VAT collected by ByUs as seller of record',
      metadata: { byus_purpose: TAX_WITHHOLDING_PURPOSE, charge_id: chargeId, tax_cents: String(taxCents) },
    },
    { idempotencyKey: `byus-tax-withhold-${chargeId}` }
  );
  return { reversalId: reversal.id, amountCents: reversal.amount };
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

// The two pieces of fan-location evidence Stripe holds on a charge (see
// lib/tax-location-evidence.js): the billing country Checkout collected and the country
// that issued the card. Either can be null (a wallet or bank payment without card details).
export async function retrieveChargeLocation({ id }) {
  const charge = await stripe.charges.retrieve(id);
  return {
    billingCountry: charge.billing_details?.address?.country || null,
    cardCountry: charge.payment_method_details?.card?.country || null,
    amountCents: charge.amount,
    createdAt: charge.created,
  };
}

// ---- Accounting (read-only) -------------------------------------------------------------
// Used by lib/accounting/sync.js to copy Stripe's own ledger into ledger_transactions.
// Everything here only reads from Stripe. Objects are returned raw (same deliberate
// "not normalized" boundary as the webhook helpers above) -- the accounting sync is the
// one place that interprets balance-transaction shapes.

// Every balance transaction on the ByUs platform account created at or after
// `createdGte` (unix seconds; omit for full history), oldest-first order not guaranteed.
// `source` is expanded so charge/refund/transfer/fee/dispute details come back inline.
export async function listBalanceTransactions({ createdGte } = {}) {
  const params = { limit: 100, expand: ['data.source'] };
  if (createdGte) params.created = { gte: createdGte };
  const rows = [];
  for await (const bt of stripe.balanceTransactions.list(params)) rows.push(bt);
  return rows;
}

export async function retrieveChargeForLedger({ id }) {
  return stripe.charges.retrieve(id, { expand: ['invoice', 'payment_intent'] });
}

export async function retrieveTransfer({ id }) {
  return stripe.transfers.retrieve(id);
}

export async function retrieveApplicationFee({ id }) {
  return stripe.applicationFees.retrieve(id);
}

// Sales tax on a one-time (payment mode) Checkout purchase lives on the Checkout Session,
// not on the charge. Returns null when no session is found.
export async function findCheckoutSessionTaxByPaymentIntent({ paymentIntentId }) {
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
  const session = sessions.data[0];
  if (!session) return null;
  return session.total_details?.amount_tax ?? 0;
}

// Payouts from a creator's connected account to their bank.
export async function listConnectedAccountPayouts({ accountId, createdGte }) {
  const params = { limit: 100 };
  if (createdGte) params.created = { gte: createdGte };
  const rows = [];
  for await (const payout of stripe.payouts.list(params, { stripeAccount: accountId })) rows.push(payout);
  return rows;
}

// Balance of the platform account (no accountId) or of a creator's connected account.
// Returns USD-only cents totals.
export async function retrieveBalanceSummary({ accountId } = {}) {
  const balance = accountId
    ? await stripe.balance.retrieve({}, { stripeAccount: accountId })
    : await stripe.balance.retrieve();
  const sum = (list) =>
    (list || []).filter((b) => b.currency === 'usd').reduce((total, b) => total + b.amount, 0);
  return { availableCents: sum(balance.available), pendingCents: sum(balance.pending) };
}

// Successful fan payments on the platform account since `createdGte` (unix seconds),
// reduced to { createdAt (unix s), country (ISO-2 or null), amountCents }. Country is the
// billing address Checkout collected (what Stripe Tax uses), falling back to the card's
// issuing country. Used by the daily digest to spot UK/EU fan payments -- the trigger for
// registering for UK/EU VAT (see lib/fan-payment-regions.js). Stops after `max` charges so
// a busy day can never make the digest time out.
export async function listSucceededChargeCountries({ createdGte, max = 3000 }) {
  const rows = [];
  for await (const charge of stripe.charges.list({ created: { gte: createdGte }, limit: 100 })) {
    if (charge.status === 'succeeded' && !charge.refunded) {
      rows.push({
        createdAt: charge.created,
        country: charge.billing_details?.address?.country || charge.payment_method_details?.card?.country || null,
        amountCents: charge.amount,
      });
    }
    if (rows.length >= max) break;
  }
  return rows;
}
