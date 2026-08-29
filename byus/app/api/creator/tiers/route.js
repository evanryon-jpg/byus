export const dynamic = 'force-dynamic';

// GET  /api/creator/tiers        -> list the logged-in creator's tiers
// POST /api/creator/tiers        -> create a new tier (also creates the matching Stripe Product + Price)

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe from '@/lib/stripe';

// Stripe itself caps unit_amount well above this, but there's no legitimate reason for
// a creator subscription tier to cost more than $2,000/month — bounding it here catches
// a typo (an extra digit or two) or a malicious/malformed value before it ever reaches
// Stripe or gets stored.
const MAX_PRICE_CENTS = 200000; // $2,000.00

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view their tiers.' }, { status: 403 });
  }

  try {
    const result = await query(
      `SELECT id, name, description, price_cents, active, created_at
       FROM subscription_tiers WHERE creator_id = $1 ORDER BY price_cents ASC`,
      [session.userId]
    );
    return NextResponse.json({ tiers: result.rows });
  } catch (err) {
    console.error('creator/tiers GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load your tiers. Try again.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can create tiers.' }, { status: 403 });
  }

  const { name, description, priceCents } = await request.json();

  if (!name || !Number.isInteger(priceCents) || priceCents < 100) {
    return NextResponse.json(
      { error: 'A tier needs a name and a price of at least $1.00 (100 cents).' },
      { status: 400 }
    );
  }
  if (priceCents > MAX_PRICE_CENTS) {
    return NextResponse.json(
      { error: `Price must be $${(MAX_PRICE_CENTS / 100).toFixed(2)} or less.` },
      { status: 400 }
    );
  }

  // Confirm this creator has completed Stripe onboarding before letting them charge fans —
  // otherwise a subscription would have nowhere to pay out to.
  const userResult = await query(
    'SELECT stripe_connect_account_id, stripe_connect_onboarded FROM users WHERE id = $1',
    [session.userId]
  );
  const creator = userResult.rows[0];
  if (!creator?.stripe_connect_onboarded) {
    return NextResponse.json(
      { error: 'Connect your Stripe account before creating a paid tier.' },
      { status: 400 }
    );
  }

  // Creating the Stripe Product/Price (or the DB insert after it) can fail - without a
  // try/catch, that throws unhandled, Next returns a bodyless 500, and the dashboard's
  // fetch crashes trying to parse it as JSON instead of showing the actual error.
  try {
    // Create the Stripe Product + recurring Price for this tier.
    const product = await stripe.products.create({ name });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: priceCents,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    const result = await query(
      `INSERT INTO subscription_tiers
         (creator_id, name, description, price_cents, stripe_price_id, stripe_product_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, price_cents, active, created_at`,
      [session.userId, name, description || null, priceCents, price.id, product.id]
    );

    return NextResponse.json({ tier: result.rows[0] });
  } catch (err) {
    console.error('creator/tiers POST failed:', err);
    return NextResponse.json(
      { error: 'Could not create this tier. Try again.' },
      { status: 500 }
    );
  }
}
