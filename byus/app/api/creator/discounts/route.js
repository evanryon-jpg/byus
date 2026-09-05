export const dynamic = 'force-dynamic';

// GET  /api/creator/discounts  -> list this creator's discount codes
// POST /api/creator/discounts  -> create a new one (a real Stripe Coupon + Promotion Code)
//
// A code always takes a percentage off a fan's FIRST payment on a tier (once), never a
// standing discount and never a flat dollar amount — see lib/discounts.js for why, and
// for MAX_DISCOUNT_PERCENT, the hard cap that keeps a subscription from ever becoming
// fully free. A fan enters the code themselves at checkout (Stripe's own "Add promotion
// code" field on the Checkout Session — see allow_promotion_codes in /api/subscribe).
//
// Stripe has no "list promotion codes belonging to creator X" filter, so codes aren't
// stored in our own database at all — each Coupon is tagged with metadata.creator_id at
// creation time, and GET lists broadly (creators create very few of these) and keeps only
// the ones tagged as this creator's own. Simpler than a new table, and Stripe is already
// the source of truth for whether a code is active or how many times it's been used.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe from '@/lib/stripe';
import { MIN_DISCOUNT_PERCENT, MAX_DISCOUNT_PERCENT, COUPON_DURATION } from '@/lib/discounts';

const CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view discount codes.' }, { status: 403 });
  }

  try {
    const tiersResult = await query(
      'SELECT name, stripe_product_id FROM subscription_tiers WHERE creator_id = $1',
      [session.userId]
    );
    const tierNameByProduct = new Map(tiersResult.rows.map((t) => [t.stripe_product_id, t.name]));

    const list = await stripe.promotionCodes.list({ limit: 100 });
    const codes = list.data
      .filter((pc) => pc.coupon?.metadata?.creator_id === session.userId)
      .map((pc) => {
        const productId = pc.coupon.applies_to?.products?.[0] || null;
        return {
          id: pc.id,
          code: pc.code,
          active: pc.active,
          percentOff: pc.coupon.percent_off,
          tierName: productId ? tierNameByProduct.get(productId) || null : null,
          timesRedeemed: pc.times_redeemed,
          maxRedemptions: pc.max_redemptions,
        };
      })
      .sort((a, b) => (a.code < b.code ? -1 : 1));

    return NextResponse.json({ codes });
  } catch (err) {
    console.error('creator/discounts GET failed:', err);
    return NextResponse.json({ error: 'Could not load your discount codes.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can create discount codes.' }, { status: 403 });
  }

  const { tierId, percentOff, code, maxRedemptions } = await request.json();

  if (!Number.isInteger(percentOff) || percentOff < MIN_DISCOUNT_PERCENT || percentOff > MAX_DISCOUNT_PERCENT) {
    return NextResponse.json(
      { error: `Percent off must be between ${MIN_DISCOUNT_PERCENT} and ${MAX_DISCOUNT_PERCENT}.` },
      { status: 400 }
    );
  }
  if (code !== undefined && code !== null && !CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: 'Code must be 3-40 characters: letters, numbers, hyphens, or underscores.' },
      { status: 400 }
    );
  }
  if (maxRedemptions !== undefined && maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
    return NextResponse.json({ error: 'Max uses must be a positive whole number.' }, { status: 400 });
  }

  try {
    let productId = null;
    let tierName = null;
    if (tierId) {
      const tierResult = await query(
        'SELECT name, stripe_product_id FROM subscription_tiers WHERE id = $1 AND creator_id = $2',
        [tierId, session.userId]
      );
      const tier = tierResult.rows[0];
      if (!tier) {
        return NextResponse.json({ error: 'Tier not found.' }, { status: 404 });
      }
      productId = tier.stripe_product_id;
      tierName = tier.name;
    }

    // duration: 'once' -- applies to a fan's first invoice only, never a standing discount
    // that could compound with the platform fee tier or a referral discount over time.
    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration: COUPON_DURATION,
      ...(productId ? { applies_to: { products: [productId] } } : {}),
      metadata: { creator_id: session.userId, tier_id: tierId || 'all' },
    });

    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      ...(code ? { code } : {}),
      ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
    });

    return NextResponse.json({
      code: {
        id: promotionCode.id,
        code: promotionCode.code,
        active: promotionCode.active,
        percentOff: coupon.percent_off,
        tierName,
        timesRedeemed: promotionCode.times_redeemed,
        maxRedemptions: promotionCode.max_redemptions,
      },
    });
  } catch (err) {
    console.error('creator/discounts POST failed:', err);
    const duplicateCode = typeof err.message === 'string' && err.message.toLowerCase().includes('already exists');
    return NextResponse.json(
      { error: duplicateCode ? 'That code is already in use — try another.' : 'Could not create this code. Try again.' },
      { status: 500 }
    );
  }
}
