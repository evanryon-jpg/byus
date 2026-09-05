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
      `SELECT id, name, description, price_cents, annual_price_cents, welcome_message, active, created_at
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

  const { name, description, priceCents, annualPriceCents, welcomeMessage } = await request.json();

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

  // Annual price is optional — a creator can offer a discounted yearly option alongside
  // the required monthly price. Same immutability reasoning as the monthly Price below (see
  // the PATCH handler's comment): once created, editing a tier can never change either price,
  // only deactivate and recreate.
  const hasAnnual = annualPriceCents !== undefined && annualPriceCents !== null;
  if (hasAnnual && (!Number.isInteger(annualPriceCents) || annualPriceCents < 100)) {
    return NextResponse.json(
      { error: 'Annual price must be at least $1.00, or left blank.' },
      { status: 400 }
    );
  }
  if (hasAnnual && annualPriceCents > MAX_PRICE_CENTS * 12) {
    return NextResponse.json(
      { error: `Annual price must be $${((MAX_PRICE_CENTS * 12) / 100).toFixed(2)} or less.` },
      { status: 400 }
    );
  }
  if (welcomeMessage !== undefined && welcomeMessage !== null && welcomeMessage.length > 500) {
    return NextResponse.json(
      { error: 'Welcome message must be 500 characters or fewer.' },
      { status: 400 }
    );
  }

  // Creators can design their page and tiers before touching Stripe at all — building the
  // Product/Price and saving the row never requires a connected payout destination. What
  // DOES require Stripe is actually letting a fan subscribe, so a tier created before
  // onboarding is saved as an inactive draft (same "Inactive" state as one a creator turned
  // off manually) instead of being blocked outright. It won't show on the public profile or
  // accept subscribers until the creator both finishes Stripe and flips it active — enforced
  // again, independently, in the PATCH handler and at /api/subscribe.
  const userResult = await query(
    'SELECT stripe_connect_account_id, stripe_connect_onboarded FROM users WHERE id = $1',
    [session.userId]
  );
  const creator = userResult.rows[0];
  const startActive = Boolean(creator?.stripe_connect_onboarded);

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

    // A second recurring Price on the same Product, billed yearly, only when the creator
    // set one — fans then choose monthly or annual at checkout (see /api/subscribe).
    let annualPrice = null;
    if (hasAnnual) {
      annualPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: annualPriceCents,
        currency: 'usd',
        recurring: { interval: 'year' },
      });
    }

    const result = await query(
      `INSERT INTO subscription_tiers
         (creator_id, name, description, price_cents, stripe_price_id, stripe_product_id, active,
          annual_price_cents, stripe_annual_price_id, welcome_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, description, price_cents, annual_price_cents, welcome_message, active, created_at`,
      [
        session.userId,
        name,
        description || null,
        priceCents,
        price.id,
        product.id,
        startActive,
        hasAnnual ? annualPriceCents : null,
        annualPrice?.id || null,
        welcomeMessage || null,
      ]
    );

    return NextResponse.json({ tier: result.rows[0], draft: !startActive });
  } catch (err) {
    console.error('creator/tiers POST failed:', err);
    return NextResponse.json(
      { error: 'Could not create this tier. Try again.' },
      { status: 500 }
    );
  }
}
