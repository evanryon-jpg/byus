export const dynamic = 'force-dynamic';

// POST /api/subscribe
// Called when a fan clicks "Subscribe" on a creator's tier. Creates a Stripe Checkout
// session that charges the fan and splits the payment between ByUs and the creator.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { paymentProvider } from '@/lib/payments';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getReferralDiscount } from '@/lib/referrals';
import { getPlatformMilestoneReductionPoints, applyPlatformMilestoneReduction } from '@/lib/fees';
import {
  TERMS_VERSION,
  MEMBERSHIP_REFUND_POLICY_VERSION,
  membershipCheckoutDisclosure,
} from '@/lib/legal';

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Please log in to subscribe.' }, { status: 401 });
  }
  if (session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can subscribe.' }, { status: 403 });
  }

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

  const { tierId, interval } = await request.json();
  if (!tierId) {
    return NextResponse.json({ error: 'tierId is required.' }, { status: 400 });
  }
  const billingInterval = interval === 'year' ? 'year' : 'month';

  try {
    const tierResult = await query(
      `SELECT t.id, t.name, t.price_cents, t.stripe_price_id, t.annual_price_cents,
              t.stripe_annual_price_id, t.creator_id, t.trial_days,
              u.stripe_connect_account_id, u.stripe_connect_onboarded, u.platform_fee_percent,
              u.review_cleared_at
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
    if (!tier.review_cleared_at) {
      return NextResponse.json(
        { error: "This creator's page is still completing an initial review. Check back soon." },
        { status: 400 }
      );
    }
    if (billingInterval === 'year' && !tier.stripe_annual_price_id) {
      return NextResponse.json({ error: 'This tier does not offer annual billing.' }, { status: 400 });
    }

    const stripePriceId = billingInterval === 'year' ? tier.stripe_annual_price_id : tier.stripe_price_id;
    const purchasePriceCents = billingInterval === 'year' ? tier.annual_price_cents : tier.price_cents;

    if (!Number.isInteger(purchasePriceCents) || purchasePriceCents <= 0) {
      return NextResponse.json({ error: 'This tier has an invalid price.' }, { status: 400 });
    }

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

    let customerId = fan.stripe_customer_id;
    if (!customerId) {
      const customer = await paymentProvider.createCustomer({ email: session.email, userId: session.userId });
      customerId = customer.customerId;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, session.userId]);
    }

    const origin = request.headers.get('origin') || process.env.APP_URL;
    const discounts = await getReferralDiscount(session.userId);
    const reductionPoints = await getPlatformMilestoneReductionPoints(query);
    const effectiveFeePercent = applyPlatformMilestoneReduction(tier.platform_fee_percent, reductionPoints);

    const disclosure = membershipCheckoutDisclosure({
      amountCents: purchasePriceCents,
      interval: billingInterval,
      trialDays: tier.trial_days,
    });

    const { url } = await paymentProvider.createSubscriptionCheckoutSession({
      customerId,
      priceId: stripePriceId,
      successUrl: `${origin}/creator/${tier.creator_id}?subscribed=true&tier=${tier.id}`,
      cancelUrl: `${origin}/creator/${tier.creator_id}`,
      applicationFeePercent: effectiveFeePercent,
      connectedAccountId: tier.stripe_connect_account_id,
      trialDays: tier.trial_days,
      discounts,
      checkoutDisclosure: disclosure,
      metadata: {
        fan_id: session.userId,
        creator_id: tier.creator_id,
        tier_id: tier.id,
        tier_name: String(tier.name || '').slice(0, 200),
        billing_interval: billingInterval,
        purchase_price_cents: String(purchasePriceCents),
        terms_version: TERMS_VERSION,
        refund_policy_version: MEMBERSHIP_REFUND_POLICY_VERSION,
        purchase_disclosure_shown: 'true',
      },
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error('subscribe failed:', err);
    return NextResponse.json(
      { error: 'Could not start checkout. Try again.' },
      { status: 500 }
    );
  }
}
