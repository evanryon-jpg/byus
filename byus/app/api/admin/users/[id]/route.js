export const dynamic = 'force-dynamic';

// PATCH /api/admin/users/[id] -> { is_suspended, suspension_reason? }
// The actual enforcement action behind a content report or a Stripe compliance concern --
// a report or a suggestion just gets *read*, this is what makes something *happen* to the
// account it's about. Suspending:
//   - blocks the account from logging in (checked in app/api/auth/login/route.js and the
//     Google/Apple callback routes) and instantly invalidates any session already open
//     (lib/session.js's getCurrentUser checks is_suspended on every request, the same
//     choke point session_version revocation already runs through)
//   - hides a suspended creator's public profile page (app/api/creators/[creatorId]/route.js
//     returns the same "not found" a nonexistent slug would) and drops them from Browse
//     and the homepage's featured list (app/api/creators/route.js)
// It deliberately does NOT touch Stripe -- it doesn't cancel subscriptions, pause payouts,
// or disconnect their Express account. Forcibly canceling a creator's subscriptions affects
// fan billing and refunds, which is a judgment call worth making per-case in the Stripe
// dashboard, not something to automate silently as a side effect of a triage click here.
//
// Gated by lib/admin.js's email allowlist, same as the rest of /api/admin.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';

const REASON_MAX = 500;

export async function PATCH(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  // The admin account is also a real creator account on ByUs (used to test the creator
  // side of the product) -- without this, a misclick here could suspend the only admin
  // login and lock the team out of /admin entirely, with no other account able to undo it.
  if (params.id === session.userId) {
    return NextResponse.json({ error: "You can't suspend your own account." }, { status: 400 });
  }

  const { is_suspended, suspension_reason } = await request.json();
  if (typeof is_suspended !== 'boolean') {
    return NextResponse.json({ error: 'is_suspended must be true or false.' }, { status: 400 });
  }

  const trimmedReason = typeof suspension_reason === 'string' ? suspension_reason.trim() : '';
  if (is_suspended && !trimmedReason) {
    return NextResponse.json(
      { error: 'A reason is required to suspend an account.' },
      { status: 400 }
    );
  }
  if (trimmedReason.length > REASON_MAX) {
    return NextResponse.json(
      { error: `Reason must be ${REASON_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  try {
    // session_version bumps alongside is_suspended -- belt-and-suspenders with the
    // is_suspended check itself. Reinstating also bumps it: a token issued before the
    // reinstatement (there shouldn't be one, since suspension already invalidated
    // everything issued up to that point) still shouldn't get a free pass.
    const result = await query(
      `UPDATE users
       SET is_suspended = $1,
           suspended_at = CASE WHEN $1 THEN now() ELSE NULL END,
           suspension_reason = CASE WHEN $1 THEN $2 ELSE NULL END,
           session_version = session_version + 1,
           updated_at = now()
       WHERE id = $3
       RETURNING id, role, display_name, email, is_suspended, suspended_at, suspension_reason`,
      [is_suspended, trimmedReason || null, params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    return NextResponse.json({ user: result.rows[0] });
  } catch (err) {
    console.error('admin/users PATCH failed:', err);
    return NextResponse.json({ error: 'Could not save this change.' }, { status: 500 });
  }
}
