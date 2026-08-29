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

import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import stripe from '@/lib/stripe';

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
          await client.query(
            `INSERT INTO subscriptions
               (fan_id, creator_id, tier_id, stripe_subscription_id, status, current_period_end, stripe_event_created_at)
             VALUES ($1, $2, $3, $4, 'active', to_timestamp($5), to_timestamp($6))
             ON CONFLICT (stripe_subscription_id) DO UPDATE
               SET status = 'active',
                   current_period_end = to_timestamp($5),
                   stripe_event_created_at = to_timestamp($6)
               WHERE subscriptions.stripe_event_created_at IS NULL
                  OR subscriptions.stripe_event_created_at <= to_timestamp($6)`,
            [
              fan_id,
              creator_id,
              tier_id,
              checkoutSession.subscription,
              stripeSubscription.current_period_end,
              event.created,
            ]
          );
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
          break;
        }

        default:
          // Unhandled event types are fine to ignore — Stripe sends many we don't need.
          break;
      }
    });
  } catch (err) {
    console.error(`Error handling webhook event ${event.type}:`, err);
    // Return 500 so Stripe retries — better to reprocess than silently drop a payment event.
    // The DB transaction above rolled back on this error, so the event was never marked
    // processed — a retry starts clean rather than being skipped as "already handled."
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
