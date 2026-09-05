export const dynamic = 'force-dynamic';

// POST /api/webhooks/stripe
// Stripe calls this URL whenever something relevant happens on OUR OWN platform account
// (a checkout succeeds, a subscription is canceled, a payment fails, etc). This is how our
// database stays in sync with reality in Stripe — never trust the frontend alone for this.
//
// Connected-account events (like a creator's Express onboarding status) are NOT delivered
// here — Stripe routes those to a separate "Connected accounts"-scoped destination with its
// own signing secret. See /api/webhooks/stripe-connect for that handler.
//
// Idempotency & ordering: Stripe does not guarantee exactly-once or in-order delivery, so
// every event is claimed (by ID, in `processed_stripe_events`) and applied inside a single
// DB transaction — a redelivered event is a guaranteed no-op, and every subscription write
// is guarded so a late-arriving/out-of-order event can never overwrite newer state.
//
// Setup: in the Stripe Dashboard, add a "Your account"-scoped webhook endpoint pointing to
//   https://yourdomain.com/api/webhooks/stripe
// and subscribe it to: checkout.session.completed, customer.subscription.deleted,
// customer.subscription.updated, invoice.payment_failed, invoice.payment_succeeded,
// charge.dispute.created, charge.dispute.closed
//
// charge.dispute.created / charge.dispute.closed: a fan's bank disputing a charge (a
// chargeback) is otherwise invisible to this app -- Stripe knows immediately, but nothing
// previously told our database, so a disputed subscription just sat there marked 'active'
// forever with no record anything was wrong. These log every dispute into
// `stripe_disputes` (linked back to the subscription/creator/fan where resolvable) so it
// shows up on the admin overview instead of silently existing only in the Stripe
// Dashboard. Deliberately does NOT auto-cancel the subscription on its own -- a dispute
// can still be won, and Stripe already sends its own customer.subscription.updated /
// .deleted events if the subscription's status actually changes as a result.
//
// invoice.payment_succeeded also does double duty as the platform's earnings ledger and
// tiered-fee trigger — see lib/fees.js. Every successful invoice (the first one included,
// not just recovery charges) gets logged against the creator it paid, and their rate is
// re-evaluated off THIS CALENDAR MONTH's total — crossing the discount threshold drops it
// for the rest of the month, and it moves back up on the first invoice of a month that
// doesn't cross it again.

import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import stripe from '@/lib/stripe';
import { rewardReferrer } from '@/lib/referrals';
import { sendWelcomeSubscriptionEmail } from '@/lib/email';
import {
  recordEarningAndCheckFeeTier,
  syncActiveSubscriptionsToFeePercent,
  syncAllActiveSubscriptionsToCurrentEffectiveFee,
} from '@/lib/fees';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Statuses we accept from Stripe, mapped 1:1 onto our own vocabulary.
const KNOWN_STATUSES = ['active', 'past_due', 'canceled'];

export async function POST(request) {
  const body = await request.text(); // raw body — required for signature verification
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    // checkout.session.completed needs a Stripe API round trip to read the Subscription's
    // metadata — do that BEFORE opening a DB transaction, so we're never holding a Postgres
    // connection (and its locks) open while waiting on a network call to Stripe.
    let stripeSubscription = null;
    if (event.type === 'checkout.session.completed' && event.data.object.mode === 'subscription') {
      stripeSubscription = await stripe.subscriptions.retrieve(event.data.object.subscription);
    }

    // Same reasoning as above: fetching the creator_id off the Subscription (where /api/subscribe
    // put it, in subscription_data.metadata — Checkout Sessions and Invoices don't carry it
    // themselves) needs a Stripe round trip, and needs to happen before this invoice's earnings
    // can be recorded. Reading it here also means the earnings ledger doesn't depend on our own
    // `subscriptions` row already existing yet — Stripe doesn't guarantee this event arrives
    // after checkout.session.completed has been processed on our side.
    let invoiceCreatorId = null;
    if (event.type === 'invoice.payment_succeeded' && event.data.object.subscription) {
      const invoiceSubscription = await stripe.subscriptions.retrieve(event.data.object.subscription);
      invoiceCreatorId = invoiceSubscription.metadata?.creator_id || null;
    }

    // A Dispute object only carries a charge ID, not which subscription (and therefore
    // which creator/fan) it belongs to -- resolve that by walking charge -> invoice ->
    // subscription, same "do the Stripe round trips before opening a DB transaction"
    // reasoning as above. Best-effort: if any lookup fails or this charge simply isn't
    // tied to a subscription, the dispute still gets recorded below, just without a link.
    let disputeSubscriptionStripeId = null;
    if (event.type === 'charge.dispute.created') {
      try {
        const charge = await stripe.charges.retrieve(event.data.object.charge);
        if (charge.invoice) {
          const invoice = await stripe.invoices.retrieve(charge.invoice);
          disputeSubscriptionStripeId = invoice.subscription || null;
        }
      } catch (err) {
        console.error('Could not resolve subscription for disputed charge:', err);
      }
    }

    // Set inside the transaction below (only when this invoice just crossed a creator over
    // their personal fee-discount threshold, and/or crossed the platform over one of its
    // own milestones), read after it commits — talking to the Stripe API to sync live
    // subscriptions doesn't belong inside an open DB transaction/lock.
    let feeTierCrossing = null;
    let platformMilestoneCrossed = false;
    // Set inside the transaction when a checkout just activated a brand-new subscription,
    // read after commit — like the fee-tier sync above, an email send is a network call
    // and doesn't belong inside an open DB transaction/lock.
    let newSubscriptionWelcome = null;

    await withTransaction(async (client) => {
      // Idempotency: claim this event ID first, in the same transaction as the state change
      // below. If the claim fails (already processed), the whole thing is a no-op — Stripe
      // retries and occasional duplicate deliveries can never double-apply an event. If the
      // process crashes between claiming and applying, the ROLLBACK undoes the claim too, so
      // a retry starts clean rather than being skipped as "already handled."
      const claim = await client.query(
        `INSERT INTO processed_stripe_events (event_id, event_type) VALUES ($1, $2)
         ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        [event.id, event.type]
      );
      if (claim.rows.length === 0) {
        console.log(`Skipping already-processed webhook event ${event.id} (${event.type})`);
        return;
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          if (!stripeSubscription) break; // not a subscription-mode checkout

          const checkoutSession = event.data.object;

          // Metadata is set on `subscription_data` in /api/subscribe, which Stripe attaches
          // to the Subscription object itself — NOT to the Checkout Session.
          const { fan_id, creator_id, tier_id } = stripeSubscription.metadata || {};
          if (!fan_id || !creator_id || !tier_id) {
            console.error('checkout.session.completed missing expected metadata', checkoutSession.id);
            break;
          }

          // The WHERE on the conflict branch is the ordering guard: if a newer event already
          // updated this row (e.g. a later status change beat this one to the database), this
          // write loses and the newer state is left standing.
          const upserted = await client.query(
            `INSERT INTO subscriptions
               (fan_id, creator_id, tier_id, stripe_subscription_id, status, current_period_end, stripe_event_created_at)
             VALUES ($1, $2, $3, $4, 'active', to_timestamp($5), to_timestamp($6))
             ON CONFLICT (stripe_subscription_id) DO UPDATE
               SET status = 'active',
                   current_period_end = to_timestamp($5),
                   stripe_event_created_at = to_timestamp($6)
               WHERE subscriptions.stripe_event_created_at IS NULL
                  OR subscriptions.stripe_event_created_at <= to_timestamp($6)
             RETURNING id`,
            [
              fan_id,
              creator_id,
              tier_id,
              checkoutSession.subscription,
              stripeSubscription.current_period_end,
              event.created,
            ]
          );

          // If this fan subscribed through a friend's referral link, this is their first
          // real payment going through — grant the referrer their free-month credit now.
          // Runs on its own connection (rewardReferrer talks to Stripe, which shouldn't
          // happen inside an open DB transaction) and is wrapped so a hiccup here — a
          // Stripe API error, say — can't fail the whole webhook and put the fan's own
          // subscription activation into a retry loop. rewardReferrer's own 'pending' ->
          // 'rewarded' guard means a retry of this event can never double-credit.
          const subscriptionRowId = upserted.rows[0]?.id;
          if (subscriptionRowId) {
            try {
              const priceCents = stripeSubscription.items?.data?.[0]?.price?.unit_amount;
              if (typeof priceCents === 'number') {
                await rewardReferrer({ fanUserId: fan_id, subscriptionRowId, priceCents });
              }
            } catch (err) {
              console.error('Referral reward failed (subscription still activated):', err);
            }
            newSubscriptionWelcome = { fanId: fan_id, creatorId: creator_id };
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          // Map Stripe's status vocabulary to ours; anything else falls back to 'incomplete'.
          const status = KNOWN_STATUSES.includes(sub.status) ? sub.status : 'incomplete';
          await client.query(
            `UPDATE subscriptions
             SET status = $1, current_period_end = to_timestamp($2), stripe_event_created_at = to_timestamp($3)
             WHERE stripe_subscription_id = $4
               AND (stripe_event_created_at IS NULL OR stripe_event_created_at <= to_timestamp($3))`,
            [status, sub.current_period_end, event.created, sub.id]
          );
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          await client.query(
            `UPDATE subscriptions
             SET status = 'canceled', stripe_event_created_at = to_timestamp($1)
             WHERE stripe_subscription_id = $2
               AND (stripe_event_created_at IS NULL OR stripe_event_created_at <= to_timestamp($1))`,
            [event.created, sub.id]
          );
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            await client.query(
              `UPDATE subscriptions
               SET status = 'past_due', stripe_event_created_at = to_timestamp($1)
               WHERE stripe_subscription_id = $2
                 AND (stripe_event_created_at IS NULL OR stripe_event_created_at <= to_timestamp($1))`,
              [event.created, invoice.subscription]
            );
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          // Covers the recovery case: a subscription that was 'past_due' (or freshly
          // 'incomplete') gets a successful charge — most commonly a fan updating their card
          // after a failure, or Stripe's automatic retry finally landing. Without this, a fan
          // who fixes their card stays locked out of subscriber-only content indefinitely,
          // since nothing else flips the status back to 'active'.
          const invoice = event.data.object;
          if (invoice.subscription) {
            await client.query(
              `UPDATE subscriptions
               SET status = 'active', stripe_event_created_at = to_timestamp($1)
               WHERE stripe_subscription_id = $2
                 AND (stripe_event_created_at IS NULL OR stripe_event_created_at <= to_timestamp($1))`,
              [event.created, invoice.subscription]
            );
          }

          // Log this payment and re-check the creator's fee rate against THIS MONTH's total
          // — see lib/fees.js. amount_paid is what the fan was actually charged (after any
          // referral discount), i.e. the real gross revenue this invoice brought the creator.
          if (invoiceCreatorId && invoice.amount_paid > 0) {
            const result = await recordEarningAndCheckFeeTier(client, {
              creatorId: invoiceCreatorId,
              stripeInvoiceId: invoice.id,
              amountCents: invoice.amount_paid,
            });
            if (result?.personalTierChange) {
              feeTierCrossing = { creatorId: invoiceCreatorId, feePercent: result.personalTierChange };
            }
            if (result?.crossedMilestones?.length > 0) {
              platformMilestoneCrossed = true;
            }
          }
          break;
        }

        case 'charge.dispute.created': {
          const dispute = event.data.object;
          let subscriptionId = null;
          let creatorId = null;
          let fanId = null;
          if (disputeSubscriptionStripeId) {
            const subResult = await client.query(
              `SELECT id, creator_id, fan_id FROM subscriptions WHERE stripe_subscription_id = $1`,
              [disputeSubscriptionStripeId]
            );
            const sub = subResult.rows[0];
            if (sub) {
              subscriptionId = sub.id;
              creatorId = sub.creator_id;
              fanId = sub.fan_id;
            }
          }
          await client.query(
            `INSERT INTO stripe_disputes
               (stripe_dispute_id, stripe_charge_id, subscription_id, creator_id, fan_id,
                amount_cents, currency, reason, status, opened_at, stripe_event_created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10), to_timestamp($10))
             ON CONFLICT (stripe_dispute_id) DO NOTHING`,
            [
              dispute.id,
              dispute.charge,
              subscriptionId,
              creatorId,
              fanId,
              dispute.amount,
              dispute.currency,
              dispute.reason || null,
              dispute.status,
              event.created,
            ]
          );
          break;
        }

        case 'charge.dispute.closed': {
          // Fires once the dispute is resolved -- dispute.status is 'won' or 'lost' by
          // this point. Same ordering guard as the other handlers: a late/out-of-order
          // delivery can never overwrite a newer status with a stale one.
          const dispute = event.data.object;
          await client.query(
            `UPDATE stripe_disputes
             SET status = $1, closed_at = to_timestamp($2), stripe_event_created_at = to_timestamp($2)
             WHERE stripe_dispute_id = $3
               AND (stripe_event_created_at IS NULL OR stripe_event_created_at <= to_timestamp($2))`,
            [dispute.status, event.created, dispute.id]
          );
          break;
        }

        default:
          // Unhandled event types are fine to ignore — Stripe sends many we don't need.
          break;
      }
    });

    // Outside the transaction, same pattern as the referral reward above: this creator just
    // crossed the discount threshold, so re-point every one of their currently live Stripe
    // subscriptions at the new (lower) fee — not just whoever subscribes next. Best-effort;
    // our own database already has the discount recorded either way, so a Stripe hiccup here
    // can't undo it or fail the webhook / trigger a retry loop.
    if (feeTierCrossing) {
      try {
        await syncActiveSubscriptionsToFeePercent(feeTierCrossing.creatorId, feeTierCrossing.feePercent);
      } catch (err) {
        console.error('Failed to sync discounted fee percent to Stripe subscriptions:', err);
      }
    }

    // A platform milestone lowers EVERY creator's effective rate at once, so this resync
    // covers every active subscription across the whole platform, not just one creator's —
    // see lib/fees.js. Same best-effort reasoning as the sync above.
    if (platformMilestoneCrossed) {
      try {
        await syncAllActiveSubscriptionsToCurrentEffectiveFee();
      } catch (err) {
        console.error('Failed to sync platform milestone fee to Stripe subscriptions:', err);
      }
    }

    // Best-effort welcome email for a brand-new subscription — never blocks or fails the
    // webhook; the subscription itself is already active either way.
    if (newSubscriptionWelcome) {
      try {
        const [fanResult, creatorResult] = await Promise.all([
          query('SELECT email FROM users WHERE id = $1', [newSubscriptionWelcome.fanId]),
          query('SELECT display_name, slug FROM users WHERE id = $1', [newSubscriptionWelcome.creatorId]),
        ]);
        const fan = fanResult.rows[0];
        const creator = creatorResult.rows[0];
        if (fan?.email && creator) {
          await sendWelcomeSubscriptionEmail(fan.email, {
            creatorName: creator.display_name || 'this creator',
            creatorUrl: `${process.env.APP_URL}/creator/${creator.slug || newSubscriptionWelcome.creatorId}`,
          });
        }
      } catch (err) {
        console.error('Failed to send welcome subscription email:', err);
      }
    }
  } catch (err) {
    console.error(`Error handling webhook event ${event.type}:`, err);
    // Return 500 so Stripe retries — better to reprocess than silently drop a payment event.
    // The DB transaction above rolled back on this error, so the event was never marked
    // processed — a retry starts clean rather than being skipped as "already handled."
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
