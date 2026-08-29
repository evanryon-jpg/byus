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
// Setup: in the Stripe Dashboard, add a "Your account"-scoped webhook endpoint pointing to
//   https://yourdomain.com/api/webhooks/stripe
// and subscribe it to: checkout.session.completed, customer.subscription.deleted,
// customer.subscription.updated, invoice.payment_failed, invoice.payment_succeeded

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import stripe from '@/lib/stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
    switch (event.type) {
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object;
        if (checkoutSession.mode !== 'subscription') break;

        const subscriptionId = checkoutSession.subscription;
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Metadata is set on `subscription_data` in /api/subscribe, which Stripe attaches
        // to the Subscription object itself — NOT to the Checkout Session. Reading it from
        // checkoutSession.metadata (as this used to) is always empty, so no subscription row
        // ever got created and fans could be charged repeatedly with no duplicate-check hit.
        const { fan_id, creator_id, tier_id } = stripeSubscription.metadata || {};
        if (!fan_id || !creator_id || !tier_id) {
          console.error('checkout.session.completed missing expected metadata', checkoutSession.id);
          break;
        }

        await query(
          `INSERT INTO subscriptions (fan_id, creator_id, tier_id, stripe_subscription_id, status, current_period_end)
           VALUES ($1, $2, $3, $4, 'active', to_timestamp($5))
           ON CONFLICT (stripe_subscription_id) DO UPDATE
             SET status = 'active', current_period_end = to_timestamp($5)`,
          [fan_id, creator_id, tier_id, subscriptionId, stripeSubscription.current_period_end]
        );
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        // Map Stripe's status vocabulary to ours; anything else falls back to 'incomplete'.
        const status = ['active', 'past_due', 'canceled'].includes(sub.status) ? sub.status : 'incomplete';
        await query(
          `UPDATE subscriptions SET status = $1, current_period_end = to_timestamp($2)
           WHERE stripe_subscription_id = $3`,
          [status, sub.current_period_end, sub.id]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await query(
          `UPDATE subscriptions SET status = 'canceled' WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await query(
            `UPDATE subscriptions SET status = 'past_due' WHERE stripe_subscription_id = $1`,
            [invoice.subscription]
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
          await query(
            `UPDATE subscriptions SET status = 'active' WHERE stripe_subscription_id = $1`,
            [invoice.subscription]
          );
        }
        break;
      }

      default:
        // Unhandled event types are fine to ignore — Stripe sends many we don't need.
        break;
    }
  } catch (err) {
    console.error(`Error handling webhook event ${event.type}:`, err);
    // Return 500 so Stripe retries — better to reprocess than silently drop a payment event.
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
