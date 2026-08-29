export const dynamic = 'force-dynamic';

// POST /api/webhooks/stripe-connect
// Handles events scoped to Stripe's "Connected accounts" event destination — this is a
// SEPARATE destination from /api/webhooks/stripe, with its own signing secret, because
// Stripe routes events about connected Express accounts (like onboarding status) through a
// different scope than events on our own platform account.
//
// account.updated: syncs `stripe_connect_onboarded` to whatever Stripe currently reports for
// that account, in EITHER direction — not just the first time onboarding completes. Stripe
// sends this same event type again if a previously-onboarded account later loses
// payouts_enabled (a risk review, a compliance hold, added requirements), so treating it as a
// one-way "flip to true and never revisit" flag would let the app keep routing new
// subscriptions to a creator who can no longer actually be paid out.
//
// account.application.deauthorized: fires when a creator disconnects our platform's access
// to their Stripe account (or Stripe removes it). We can no longer charge or pay out against
// it, so this also resets the creator to not-onboarded.
//
// Setup: in the Stripe Dashboard, add a "Connected accounts"-scoped webhook endpoint
// pointing to https://yourdomain.com/api/webhooks/stripe-connect, subscribed to:
// account.updated, account.application.deauthorized

import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
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
    await withTransaction(async (client) => {
      // Same idempotency pattern as /api/webhooks/stripe — claim the event ID before
      // acting on it, in the same transaction, so a redelivered event is a safe no-op.
      const claim = await client.query(
        `INSERT INTO processed_stripe_events (event_id, event_type) VALUES ($1, $2)
         ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        [event.id, event.type]
      );
      if (claim.rows.length === 0) {
        console.log(`Skipping already-processed Connect webhook event ${event.id} (${event.type})`);
        return;
      }

      switch (event.type) {
        case 'account.updated': {
          const account = event.data.object;
          // Always sync to what Stripe reports right now, in either direction, rather than
          // only ever setting this to true.
          const onboarded = Boolean(account.details_submitted && account.payouts_enabled);
          await client.query(
            `UPDATE users SET stripe_connect_onboarded = $1 WHERE stripe_connect_account_id = $2`,
            [onboarded, account.id]
          );
          break;
        }

        case 'account.application.deauthorized': {
          // This event's payload doesn't carry the account as event.data.object — the
          // connected account ID is on the event itself.
          await client.query(
            `UPDATE users SET stripe_connect_onboarded = false WHERE stripe_connect_account_id = $1`,
            [event.account]
          );
          break;
        }

        default:
          // Unhandled event types are fine to ignore.
          break;
      }
    });
  } catch (err) {
    console.error(`Error handling Connect webhook event ${event.type}:`, err);
    // Return 500 so Stripe retries — better to reprocess than silently drop an onboarding update.
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
