export const dynamic = 'force-dynamic';

// POST /api/creators/:creatorId/tip
// A one-time "buy a coffee" payment — no tier, no subscription, no commitment.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { paymentProvider } from '@/lib/payments';
import { MIN_TIP_CENTS, MAX_TIP_CENTS } from '@/lib/pricing';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getPlatformMilestoneReductionPoints, applyPlatformMilestoneReduction } from '@/lib/fees';
import { TERMS_VERSION, TIP_REFUND_POLICY_VERSION, tipCheckoutDisclosure } from '@/lib/legal';

const MAX_TIP_MESSAGE_LENGTH = 300;

function safeReturnPath(candidate, creatorId) {
  if (typeof candidate === 'string' && /^\/creator\/[A-Za-z0-9_-]+(\/tip)?$/.test(candidate)) {
    return candidate;
  }
  if (candidate === '/support') {
    return candidate;
  }
  return `/creator/${creatorId}`;
}

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
  const { amountCents, message, returnTo } = await request.json();
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
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (trimmedMessage.length > MAX_TIP_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_TIP_MESSAGE_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  try {
    const creatorResult = await query(
      `SELECT id, display_name, stripe_connect_account_id, stripe_connect_onboarded, platform_fee_percent,
              review_cleared_at
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
    if (!creator.review_cleared_at) {
      return NextResponse.json(
        { error: "This creator's page is still completing an initial review. Check back soon." },
        { status: 400 }
      );
    }

    let customerId = fan.stripe_customer_id;
    if (!customerId) {
      const customer = await paymentProvider.createCustomer({ email: session.email, userId: session.userId });
      customerId = customer.customerId;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, session.userId]);
    }

    const reductionPoints = await getPlatformMilestoneReductionPoints(query);
    const effectiveFeePercent = applyPlatformMilestoneReduction(creator.platform_fee_percent, reductionPoints);
    const applicationFeeCents = Math.round((amountCents * effectiveFeePercent) / 100);

    const origin = request.headers.get('origin') || process.env.APP_URL;
    const returnPath = safeReturnPath(returnTo, creator.id);

    const { url } = await paymentProvider.createOneTimePaymentCheckoutSession({
      customerId,
      amountCents,
      productName: `Tip for ${creator.display_name || 'this creator'}`,
      applicationFeeCents,
      connectedAccountId: creator.stripe_connect_account_id,
      successUrl: `${origin}${returnPath}?tipped=true`,
      cancelUrl: `${origin}${returnPath}`,
      checkoutDisclosure: tipCheckoutDisclosure(),
      metadata: {
        type: 'tip',
        fan_id: session.userId,
        creator_id: creator.id,
        purchase_price_cents: String(amountCents),
        terms_version: TERMS_VERSION,
        refund_policy_version: TIP_REFUND_POLICY_VERSION,
        purchase_disclosure_shown: 'true',
        ...(trimmedMessage ? { message: trimmedMessage } : {}),
      },
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error('tip checkout failed:', err);
    return NextResponse.json(
      { error: 'Could not start checkout. Try again.' },
      { status: 500 }
    );
  }
}
