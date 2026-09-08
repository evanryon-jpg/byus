export const dynamic = 'force-dynamic';

// POST /api/creator/acknowledge-policy
// Closes one specific compliance gap: app/api/creator/connect-stripe/route.js only ever
// records content_policy_accepted_at the first time a creator connects Stripe (its
// `if (!accountId)` branch), so any creator who connected before that gate existed has
// stripe_connect_onboarded = true but no acknowledgment on record. This route is the
// retroactive version of that same gate -- see AcknowledgePolicyBanner in
// app/creator/dashboard/page.js, which is shown exactly when this gap applies to the
// logged-in creator and posts here once they check the same box connect-stripe uses.
//
// Requires stripe_connect_onboarded already true. A creator who hasn't connected Stripe
// yet has no gap to close -- they'll hit the original gate in connect-stripe when they do.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function POST() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can do this.' }, { status: 403 });
  }

  try {
    const result = await query(
      `UPDATE users
       SET content_policy_accepted_at = COALESCE(content_policy_accepted_at, now())
       WHERE id = $1 AND stripe_connect_onboarded = true
       RETURNING content_policy_accepted_at`,
      [session.userId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Connect Stripe first, then come back and confirm this.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ user: { content_policy_accepted_at: result.rows[0].content_policy_accepted_at } });
  } catch (err) {
    console.error('acknowledge-policy POST failed:', err);
    return NextResponse.json({ error: 'Could not save this. Try again.' }, { status: 500 });
  }
}
