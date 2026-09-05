export const dynamic = 'force-dynamic';

// POST /api/creators/:creatorId/tip
// A one-time "buy a coffee" payment — no tier, no subscription, no commitment. Same
// destination-charge split as a subscription (ByUs keeps the creator's current
// platform_fee_percent, see lib/fees.js), just a single payment instead of a recurring
// one. Recorded in `transactions` (subscription_id left NULL — the schema already
// supports a one-off payment, it just had nothing writing to it until now) and in
// `creator_earnings` via the same recordEarningAndCheckFeeTier() a subscription invoice
// uses, so a generous month of tips counts toward the creator's monthly fee-discount
// threshold exactly like subscription revenue does. See app/api/webhooks/stripe/route.js
// for where the payment is actually confirmed and recorded — this route only starts
// checkout.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe, { MIN_TIP_CENTS, MAX_TIP_CENTS } from '@/lib/stripe';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getPlatformMilestoneReductionPoints, applyPlatformMilestoneReduction } from '@/lib/fees';

export async function POST(request, { params }) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Please log in to send a tip.' }, { status: 401 });
  }
  if (session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can send tips.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('tip', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const fanResult = await query(
    'SELECT email_verified, stripe_customer_id FROM users WHERE id = $1',
    [session.userId]
  );
  const fan = fanResult.rows[0];
  if (!fan?.email_verified) {
    return NextResponse.json(
      { error: 'Verify your email address before sending a tip.' },
      { status: 403 }
    );
  }

  const { creatorId } = params;
  const { amountCents } = await request.json();
  if (!Number.isInteger(amountCents) || amountCents < MIN_TIP_CENTS) {
    return NextResponse.json(
      { error: `A tip must be at least $${(MIN_TIP_CENTS / 100).toFixed(2)}.` },
      { status: 400 }
    );
  }
  if (amountCents > MAX_TIP_CENTS) {
    return NextResponse.json(
      { error: `A tip must be $${(MAX_TIP_CENTS / 100).toFixed(2)} or less.` },
      { status: 400 }
    );
  }
  if (session.userId === creatorId) {
    return NextResponse.json({ error: "You can't tip your own page." }, { status: 400 });
  }

  try {
    const creatorResult = await query(
      `SELECT id, display_name, stripe_connect_account_id, stripe_connect_onboarded, platform_fee_percent
       FROM users WHERE id = $1 AND role = 'creator'`,
      [creatorId]
    );
    const creator = creatorResult.rows[0];
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
    }
    if (!creator.stripe_connect_onboarded) {
      return NextResponse.json({ error: 'This creator has not finished payment setup yet.' }, { status: 400 });
    }

    // Reuse this fan's existing Stripe Customer, same reasoning as /api/subscribe — one
    // Customer per fan across every creator, not a fresh one per checkout.
    let customerId = fan.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.email,
        metadata: { user_id: session.userId },
      });
      customerId = customer.id;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, session.userId]);
    }

    const reductionPoints = await getPlatformMilestoneReductionPoints(query);
    const effectiveFeePercent = applyPlatformMilestoneReduction(creator.platform_fee_percent, reductionPoints);
    const applicationFeeCents = Math.round((amountCents * effectiveFeePercent) / 100);

    const origin = request.headers.get('origin') || process.env.APP_URL;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Tip for ${creator.display_name || 'this creator'}` },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: creator.stripe_connect_account_id,
        },
        metadata: {
          type: 'tip',
          fan_id: session.userId,
          creator_id: creator.id,
        },
      },
      // ?tipped=true triggers a thank-you banner on the creator's page — same pattern as
      // ?subscribed=true after a subscription checkout.
      success_url: `${origin}/creator/${creator.id}?tipped=true`,
      cancel_url: `${origin}/creator/${creator.id}`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('tip checkout failed:', err);
    return NextResponse.json(
      { error: 'Could not start checkout. Try again.' },
      { status: 500 }
    );
  }
}
