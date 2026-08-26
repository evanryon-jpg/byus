export const dynamic = 'force-dynamic';

// POST /api/creator/connect-stripe
// Called when a creator clicks "Start earning". Creates a Stripe Express connected account
// (if they don't already have one) and returns a link to Stripe's hosted onboarding flow.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe from '@/lib/stripe';

export async function POST(request) {
  const session = getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can connect a Stripe account.' }, { status: 403 });
  }

  const userResult = await query('SELECT id, email, stripe_connect_account_id FROM users WHERE id = $1', [
    session.userId,
  ]);
  const user = userResult.rows[0];
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  let accountId = user.stripe_connect_account_id;

  // Only create a new Stripe account if this creator doesn't already have one.
  // Re-running this after a partial/abandoned onboarding should resume, not duplicate.
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await query('UPDATE users SET stripe_connect_account_id = $1 WHERE id = $2', [accountId, user.id]);
  }

  // Generate a fresh onboarding link. These links expire quickly, so always generate
  // a new one right before redirecting rather than reusing an old one.
  const origin = request.headers.get('origin') || process.env.APP_URL;
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/creator/onboarding?refresh=true`,
    return_url: `${origin}/creator/onboarding?complete=true`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
