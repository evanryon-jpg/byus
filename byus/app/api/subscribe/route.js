export const dynamic = 'force-dynamic';

// POST /api/subscribe
// Called when a fan clicks "Subscribe" on a creator's tier. Creates a Stripe Checkout
// session that, on completion, charges the fan monthly and automatically splits the
// payment: ByUs keeps PLATFORM_FEE_PERCENT, the rest goes to the creator's connected account.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe, { PLATFORM_FEE_PERCENT } from '@/lib/stripe';

export async function POST(request) {
  const session = getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can subscribe.' }, { status: 403 });
  }

  const { tierId } = await request.json();
  if (!tierId) {
    return NextResponse.json({ error: 'tierId is required.' }, { status: 400 });
  }

  try {
    const tierResult = await query(
      `SELECT t.id, t.stripe_price_id, t.creator_id, u.stripe_connect_account_id, u.stripe_connect_onboarded
       FROM subscription_tiers t
       JOIN users u ON u.id = t.creator_id
       WHERE t.id = $1 AND t.active = true`,
      [tierId]
    );
    const tier = tierResult.rows[0];
    if (!tier) {
      return NextResponse.json({ error: 'Tier not found or no longer available.' }, { status: 404 });
    }
    if (!tier.stripe_connect_onboarded) {
      return NextResponse.json({ error: 'This creator has not finished payment setup yet.' }, { status: 400 });
    }

    // Prevent subscribing to your own content, and prevent duplicate active subscriptions
    // to the same tier (fans should manage/cancel from their dashboard, not double-subscribe).
    if (session.userId === tier.creator_id) {
      return NextResponse.json({ error: "You can't subscribe to your own content." }, { status: 400 });
    }
    const existing = await query(
      `SELECT id FROM subscriptions WHERE fan_id = $1 AND tier_id = $2 AND status = 'active'`,
      [session.userId, tierId]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'You already have an active subscription to this tier.' }, { status: 409 });
    }

    const origin = request.headers.get('origin') || process.env.APP_URL;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: session.email,
      line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/fan/dashboard?subscribed=true`,
      cancel_url: `${origin}/creator/${tier.creator_id}`,
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_PERCENT,
        transfer_data: {
          destination: tier.stripe_connect_account_id,
        },
        metadata: {
          fan_id: session.userId,
          creator_id: tier.creator_id,
          tier_id: tier.id,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('subscribe failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not start checkout. Try again.' },
      { status: 500 }
    );
  }
}
