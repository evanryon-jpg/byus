export const dynamic = 'force-dynamic';

// GET /api/me/referral
// Returns the current user's referral link (generating a referral_code the first
// time they ask for one) plus simple stats: how many people signed up through it,
// and how many of those have gone on to pay for a subscription and triggered the
// free-month reward for both sides. See lib/referrals.js and /api/subscribe for
// where a referral gets created and rewarded.
//
// The actual code-generation/stats query lives in lib/referrals.js
// (loadReferralSummary), shared with the settings page's server-side initial load
// (app/settings/page.js) so the two can't report different numbers for the same user.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { loadReferralSummary } from '@/lib/referrals';

export async function GET(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  try {
    // request.url's own origin, same as every OAuth route does — headers.get('origin')
    // isn't reliably sent on a same-origin GET, so it's not a safe source here.
    const { origin } = new URL(request.url);
    const summary = await loadReferralSummary(session.userId, origin);
    return NextResponse.json(summary);
  } catch (err) {
    console.error('me/referral GET failed:', err);
    return NextResponse.json({ error: 'Could not load your referral link. Try again.' }, { status: 500 });
  }
}
