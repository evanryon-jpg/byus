export const dynamic = 'force-dynamic';

// POST /api/webhooks/stripe
// Stripe calls this URL whenever something relevant happens (account onboarding completes,
// a checkout succeeds, a subscription is canceled, a payment fails, etc). This is how our
// database stays in sync with reality in Stripe — never trust the frontend alone for this.
//
// Setup: in the Stripe Dashboard, add a webhook endpoint pointing to
//   https://yourdomain.com/api/webhooks/stripe
// and subscribe it to: account.updated, checkout.session.completed,
// customer.subscription.deleted, customer.subscription.updated, invoice.payment_failed

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
      case 'account.updated': {
        const account = event.data.object;
        if (account.details_submitted && account.payouts_enabled) {
          await query(
            `UPDATE users SET stripe_connect_onboarded = true WHERE stripe_connect_account_id = $1`,
            [account.id]
          );
        }
        break;
      }

      case 'checkout.session.completed': {
        const checkoutSession = event.data.object;
        if (checkoutSession.mode !== 'subscription') break;

        const subscriptionId = checkoutSession.subscription;
        const { fan_id, creator_id, tier_id } = checkoutSession.metadata || {};
        if (!fan_id || !creator_id || !tier_id) {
          console.error('checkout.session.completed missing expected metadata', checkoutSession.id);
          break;
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

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
