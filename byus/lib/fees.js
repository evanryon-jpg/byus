// Tiered platform fee. Every creator starts at STANDARD_FEE_PERCENT; once the total of
// every successful invoice they've ever been paid (across every subscriber and tier —
// tracked below in creator_earnings, which doubles as the platform's first real payments
// ledger) crosses FEE_DISCOUNT_THRESHOLD_CENTS, their rate drops to DISCOUNTED_FEE_PERCENT
// for good. A slow month afterward never pushes them back up — the discount is earned once
// and kept.
//
// The crossing is detected inside the Stripe webhook (see app/api/webhooks/stripe/route.js,
// case 'invoice.payment_succeeded'), which is the only place a payment is confirmed to have
// actually happened. This file has two halves that run at different times for that reason:
// recordEarningAndCheckFeeTier does the DB bookkeeping inside the webhook's existing
// transaction, while syncActiveSubscriptionsToFeePercent talks to the Stripe API afterward,
// once that transaction has committed — same split the webhook already uses for referral
// rewards, and for the same reason (a network call to Stripe has no business happening
// while a DB transaction is holding locks open).

import { query } from './db';
import stripe from './stripe';
import { DISCOUNTED_FEE_PERCENT, FEE_DISCOUNT_THRESHOLD_CENTS } from './stripe';

// Runs inside the webhook's DB transaction (`client` is that transaction's connection).
// Records this invoice's payment in the ledger — idempotent on stripe_invoice_id, a
// belt-and-suspenders guard on top of the webhook's own per-event idempotency claim — and,
// if this payment just pushed the creator's lifetime total over the threshold, flips their
// stored fee rate. Returns the new fee percent when (and only when) it just changed, so the
// caller knows to sync it out to Stripe once the transaction is safely committed; returns
// null otherwise (duplicate delivery, not a creator, already discounted, or still under the
// threshold).
export async function recordEarningAndCheckFeeTier(client, { creatorId, stripeInvoiceId, amountCents }) {
  if (!creatorId || !stripeInvoiceId || !(amountCents > 0)) return null;

  // Lock the creator's row before recording anything, for two reasons at once: it stops
  // two of their invoices landing in overlapping webhook deliveries from both reading the
  // pre-crossing total and both thinking they're the one that needs to flip it, and the
  // fee percent it reads is the rate that actually applied to THIS invoice — stamped onto
  // the ledger row below so later fee-tier changes never distort this payment's historical
  // net-earnings math.
  const creatorResult = await client.query(
    `SELECT platform_fee_percent FROM users WHERE id = $1 FOR UPDATE`,
    [creatorId]
  );
  const currentFeePercent = creatorResult.rows[0]?.platform_fee_percent;
  if (currentFeePercent === undefined) return null; // not a creator row

  const inserted = await client.query(
    `INSERT INTO creator_earnings (creator_id, stripe_invoice_id, amount_cents, fee_percent_applied)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (stripe_invoice_id) DO NOTHING
     RETURNING id`,
    [creatorId, stripeInvoiceId, amountCents, currentFeePercent]
  );
  if (inserted.rows.length === 0) return null; // already recorded — redelivered event

  if (currentFeePercent <= DISCOUNTED_FEE_PERCENT) return null; // already at (or below) the discounted rate

  const totalResult = await client.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total FROM creator_earnings WHERE creator_id = $1`,
    [creatorId]
  );
  const lifetimeTotalCents = Number(totalResult.rows[0].total);
  if (lifetimeTotalCents < FEE_DISCOUNT_THRESHOLD_CENTS) return null;

  await client.query('UPDATE users SET platform_fee_percent = $1 WHERE id = $2', [
    DISCOUNTED_FEE_PERCENT,
    creatorId,
  ]);
  return DISCOUNTED_FEE_PERCENT;
}

// Best-effort, run AFTER the DB transaction that called recordEarningAndCheckFeeTier has
// committed: re-points every one of the creator's currently active (or past_due — still
// billing, just recovering from a card issue) Stripe subscriptions at the new fee percent,
// so existing subscribers move to the discounted rate too, not just anyone who subscribes
// after the crossing. A failure here is logged, not thrown — our own database has already
// recorded the discount, so nothing about the crossing itself is lost; a subscription that
// misses this sync would just keep billing at the old rate until fixed by hand, which is
// rare enough and low-stakes enough (a creator who's still growing, being slightly
// overcharged on ByUs's side of the split rather than shorted) not to need a retry queue.
export async function syncActiveSubscriptionsToFeePercent(creatorId, feePercent) {
  const subsResult = await query(
    `SELECT stripe_subscription_id FROM subscriptions
     WHERE creator_id = $1 AND status IN ('active', 'past_due')`,
    [creatorId]
  );
  for (const { stripe_subscription_id } of subsResult.rows) {
    try {
      await stripe.subscriptions.update(stripe_subscription_id, { application_fee_percent: feePercent });
    } catch (err) {
      console.error(`Failed to sync application_fee_percent for subscription ${stripe_subscription_id}:`, err);
    }
  }
}
