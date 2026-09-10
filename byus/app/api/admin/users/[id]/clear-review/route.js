export const dynamic = 'force-dynamic';

// POST /api/admin/users/:id/clear-review
// Clears ByUs's one-time initial review for a creator (users.review_cleared_at) -- until
// this fires, /api/creator/posts holds everything they publish out of public view
// (posts.pending_review) and /api/subscribe + the tip route refuse to let a fan pay them
// at all, so there's no first payout to hold. This is what Stripe's compliance review
// asked for: a real, structural gate a human has to clear, not just a policy that says
// someone eventually will look.
//
// Clearing is one-way -- there's no "un-clear," the same way there's no un-suspending
// past what /api/admin/users/[id] already does for that. Publishes any posts this
// creator already made while pending, since the whole point of the hold was "don't go
// public until reviewed," not "stay hidden forever even after being reviewed."
//
// Gated by lib/admin.js's email allowlist, same as the rest of /api/admin.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';

export async function POST(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  try {
    const result = await query(
      `UPDATE users SET review_cleared_at = COALESCE(review_cleared_at, now())
       WHERE id = $1 AND role = 'creator'
       RETURNING id, review_cleared_at`,
      [params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
    }

    await query(`UPDATE posts SET pending_review = false WHERE creator_id = $1`, [params.id]);

    return NextResponse.json({ user: result.rows[0] });
  } catch (err) {
    console.error('admin/users/[id]/clear-review POST failed:', err);
    return NextResponse.json({ error: 'Could not clear this creator for review.' }, { status: 500 });
  }
}
