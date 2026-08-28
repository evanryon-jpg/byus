export const dynamic = 'force-dynamic';

// POST /api/webhooks/stripe-connect
// Handles events scoped to Stripe's "Connected accounts" event destination — this is a
// SEPARATE destination from /api/webhooks/stripe, with its own signing secret, because
// Stripe routes events about connected Express accounts (like onboarding status) through a
// different scope than events on our own platform account.
//
// Currently handles account.updated: once a creator finishes Stripe's hosted onboarding and
// Stripe confirms details_submitted + payouts_enabled, we mark them onboarded so they can
// create paid tiers and start earning.
//
// Setup: in the Stripe Dashboard, add a "Connected accounts"-scoped webhook endpoint
// pointing to https://yourdomain.com/api/webhooks/stripe-connect, subscribed to:
// account.updated

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import stripe from '@/lib/stripe';

const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

export async function POST(request) {
  const body = await request.text(); // raw body — required for signature verification
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Connect webhook signature verification failed:', err.message);
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

      default:
        // Unhandled event types are fine to ignore.
        break;
    }
  } catch (err) {
    console.error(`Error handling Connect webhook event ${event.type}:`, err);
    // Return 500 so Stripe retries — better to reprocess than silently drop an onboarding update.
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
