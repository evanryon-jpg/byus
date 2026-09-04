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
// customer.subscription.updated, invoice.payment_failed, invoice.payment_succeeded
//
// invoice.payment_succeeded also does double duty as the platform's earnings ledger and
// tiered-fee trigger — see lib/fees.js. Every successful invoice (the first one included,
// not just recovery charges) gets logged against the creator it paid, and once their
// lifetime total crosses the discount threshold their rate drops for good.

import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import stripe from '@/lib/stripe';
import { rewardReferrer } from '@/lib/referrals';
import { recordEarningAndCheckFeeTier, syncActiveSubscriptionsToFeePercent } from '@/lib/fees';

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

    // Set inside the transaction below (only when this invoice just crossed a creator over
    // the fee-discount threshold), read after it commits — talking to the Stripe API to sync
    // their live subscriptions doesn't belong inside an open DB transaction/lock.
    let feeTierCrossing = null;

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

          // Log this payment against the creator's lifetime earnings, and flip their stored
          // fee rate if it just crossed the discount threshold — see lib/fees.js. amount_paid
          // is what the fan was actually charged (after any referral discount), i.e. the real
          // gross revenue this invoice brought the creator.
          if (invoiceCreatorId && invoice.amount_paid > 0) {
            const newFeePercent = await recordEarningAndCheckFeeTier(client, {
              creatorId: invoiceCreatorId,
              stripeInvoiceId: invoice.id,
              amountCents: invoice.amount_paid,
            });
            if (newFeePercent) {
              feeTierCrossing = { creatorId: invoiceCreatorId, feePercent: newFeePercent };
            }
          }
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
  } catch (err) {
    console.error(`Error handling webhook event ${event.type}:`, err);
    // Return 500 so Stripe retries — better to reprocess than silently drop a payment event.
    // The DB transaction above rolled back on this error, so the event was never marked
    // processed — a retry starts clean rather than being skipped as "already handled."
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
