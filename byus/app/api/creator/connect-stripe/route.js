export const dynamic = 'force-dynamic';

// POST /api/creator/connect-stripe
// Called when a creator clicks "Start earning". Creates a Stripe Express connected account
// (if they don't already have one) and returns a link to Stripe's hosted onboarding flow.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { paymentProvider } from '@/lib/payments';
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
    const userResult = await query(
      'SELECT id, email, slug, stripe_connect_account_id, email_verified FROM users WHERE id = $1',
      [session.userId]
    );
    const user = userResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    if (!user.email_verified) {
      return NextResponse.json(
        { error: 'Verify your email address before connecting Stripe.' },
        { status: 403 }
      );
    }

    // Needed below both for the connected account's business_profile.url (on first-time
    // creation only) and for the onboarding link's refresh/return URLs — computed once,
    // up front, rather than twice.
    const origin = request.headers.get('origin') || process.env.APP_URL;

    let accountId = user.stripe_connect_account_id;

    // Only create a new Stripe account if this creator doesn't already have one.
    // Re-running this after a partial/abandoned onboarding should resume, not duplicate.
    if (!accountId) {
      // First-time connect only: require the explicit content-policy acknowledgment from
      // the dashboard's checkbox (see app/creator/dashboard/page.js) before this creator
      // can ever start collecting payments. A retry/reconnect of an *existing* account
      // (below, once accountId is already set) doesn't re-send this -- they already
      // cleared this gate the first time through. Recorded server-side, not just checked
      // client-side, so there's a durable timestamp of when each creator agreed, not just
      // a UI checkbox nobody can later point to.
      const { acknowledgePolicy } = await request.json().catch(() => ({}));
      if (!acknowledgePolicy) {
        return NextResponse.json(
          { error: 'You need to agree to the content guidelines before connecting Stripe.' },
          { status: 400 }
        );
      }

      // Slug is usually unset this early (claimed later from the dashboard), but the
      // UUID-based page URL is permanent -- app/api/creators/[creatorId]/route.js resolves
      // it forever, even after a slug is claimed -- so this URL never needs to be updated
      // on Stripe's side later.
      const profileUrl = `${origin}/creator/${user.slug || user.id}`;
      const { accountId: newAccountId } = await paymentProvider.createConnectedAccount({
        email: user.email,
        url: profileUrl,
      });
      accountId = newAccountId;
      await query(
        `UPDATE users SET stripe_connect_account_id = $1,
                          content_policy_accepted_at = COALESCE(content_policy_accepted_at, now())
         WHERE id = $2`,
        [accountId, user.id]
      );
    }

    // Generate a fresh onboarding link. These links expire quickly, so always generate
    // a new one right before redirecting rather than reusing an old one.
    const { url } = await paymentProvider.createAccountOnboardingLink({
      accountId,
      refreshUrl: `${origin}/creator/onboarding?refresh=true`,
      returnUrl: `${origin}/creator/onboarding?complete=true`,
    });

    return NextResponse.json({ url });
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
