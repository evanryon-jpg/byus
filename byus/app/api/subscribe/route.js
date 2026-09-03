export const dynamic = 'force-dynamic';

// POST /api/subscribe
// Called when a fan clicks "Subscribe" on a creator's tier. Creates a Stripe Checkout
// session that, on completion, charges the fan monthly and automatically splits the
// payment: ByUs keeps PLATFORM_FEE_PERCENT, the rest goes to the creator's connected account.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe, { PLATFORM_FEE_PERCENT } from '@/lib/stripe';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getReferralDiscount } from '@/lib/referrals';

export async function POST(request) {
  const session = await getCurrentUser();
  // Split "not logged in" from "wrong role": the client redirects straight to login (and
  // back again afterward) on the first, but that would be a dead end for the second — a
  // creator's own account is never going to become a fan by logging in again.
  if (!session) {
    return NextResponse.json({ error: 'Please log in to subscribe.' }, { status: 401 });
  }
  if (session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can subscribe.' }, { status: 403 });
  }

  // Rate limit by user — this endpoint is authenticated, so the account itself is the
  // identifier. Guards against a script hammering Stripe Checkout session creation.
  const rateCheck = await checkRateLimit('subscribe', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const fanResult = await query(
    'SELECT email_verified, stripe_customer_id FROM users WHERE id = $1',
    [session.userId]
  );
  const fan = fanResult.rows[0];
  if (!fan?.email_verified) {
    return NextResponse.json(
      { error: 'Verify your email address before subscribing.' },
      { status: 403 }
    );
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

    // Reuse this fan's existing Stripe Customer across every subscription rather than
    // letting Checkout mint a new one per checkout (its default behavior when only
    // `customer_email` is passed). Without this, a fan who subscribes to two creators ends
    // up as two unrelated Stripe customers, and the billing portal — which is scoped to a
    // single customer — would only ever show one of their subscriptions.
    let customerId = fan.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.email,
        metadata: { user_id: session.userId },
      });
      customerId = customer.id;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, session.userId]);
    }

    const origin = request.headers.get('origin') || process.env.APP_URL;

    // If this fan signed up through someone's referral link and hasn't already had a
    // referral reward on some other subscription, their first month here is free — see
    // lib/referrals.js. This is a real Stripe discount applied at checkout, not
    // something faked client-side, so it shows up correctly on their invoice too.
    const discounts = await getReferralDiscount(session.userId);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
      // Back to the creator's own page, not a generic dashboard — that's where the content
      // the fan just paid for actually lives. ?subscribed=true triggers a welcome banner there.
      success_url: `${origin}/creator/${tier.creator_id}?subscribed=true`,
      cancel_url: `${origin}/creator/${tier.creator_id}`,
      ...(discounts ? { discounts } : {}),
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
      { error: 'Could not start checkout. Try again.' },
      { status: 500 }
    );
  }
}
