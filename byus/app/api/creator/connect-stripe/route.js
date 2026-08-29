export const dynamic = 'force-dynamic';

// POST /api/creator/connect-stripe
// Called when a creator clicks "Start earning". Creates a Stripe Express connected account
// (if they don't already have one) and returns a link to Stripe's hosted onboarding flow.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import stripe from '@/lib/stripe';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can connect a Stripe account.' }, { status: 403 });
  }

  // Rate limit by user — this hits the Stripe API to create/link an account, unlike most
  // reads, so it's worth guarding the same way the other Stripe-touching routes are.
  const rateCheck = await checkRateLimit('connect-stripe', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  // Everything below can throw - a Stripe API error (e.g. Connect not yet activated on this
  // platform's account) or a database error would otherwise propagate as an unhandled
  // exception, which Next turns into a bare 500 with no JSON body. The dashboard's fetch call
  // then crashes trying to parse that as JSON, leaving the "Redirecting..." button stuck
  // forever with no explanation. Catching it here means the creator actually sees what went
  // wrong (Stripe's own error messages are usually specific and actionable).
  try {
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
  } catch (err) {
    console.error('connect-stripe failed:', err);
    // Stripe's own error messages are logged above for debugging, but not forwarded to the
    // client: some of Stripe's internal/account-config error text isn't meant for an end
    // user, and raw error forwarding is also just a bad habit to have on any authenticated
    // route (it can leak internal details on errors that don't originate from Stripe at all).
    return NextResponse.json(
      { error: 'Could not start Stripe onboarding. Try again.' },
      { status: 500 }
    );
  }
}
