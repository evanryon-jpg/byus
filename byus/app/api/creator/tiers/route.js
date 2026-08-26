export const dynamic = 'force-dynamic';

// GET  /api/creator/tiers        -> list the logged-in creator's tiers
// POST /api/creator/tiers        -> create a new tier (also creates the matching Stripe Product + Price)

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe from '@/lib/stripe';

export async function GET() {
  const session = getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view their tiers.' }, { status: 403 });
  }

  const result = await query(
    `SELECT id, name, description, price_cents, active, created_at
     FROM subscription_tiers WHERE creator_id = $1 ORDER BY price_cents ASC`,
    [session.userId]
  );
  return NextResponse.json({ tiers: result.rows });
}

export async function POST(request) {
  const session = getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can create tiers.' }, { status: 403 });
  }

  const { name, description, priceCents } = await request.json();

  if (!name || !priceCents || priceCents < 100) {
    return NextResponse.json(
      { error: 'A tier needs a name and a price of at least $1.00 (100 cents).' },
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
}
