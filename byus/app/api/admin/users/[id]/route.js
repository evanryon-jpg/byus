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
//   - pauses payouts on their Stripe Connect account and pauses billing on every one of
//     their active subscriptions (see the Stripe calls below) -- this used to be a
//     deliberate gap ("suspending doesn't touch Stripe, do that by hand in the
//     dashboard"), closed as of Sept 2026 per Stripe's own compliance review, which
//     specifically asked for evidence that a moderation action actually blocks money
//     moving, automatically, not as a manual follow-up step someone might forget.
// Reinstating (is_suspended: false) reverses both: payouts resume on ByUs's default
// schedule and subscription billing resumes on its normal cycle. Neither pause cancels
// anything -- a subscription stays active and billing resumes exactly where it left off,
// a Connect account keeps accumulating balance while paused -- reinstatement is meant to
// put a wrongly- or provisionally-suspended creator back to normal with nothing to clean
// up, not to make suspension something ByUs is reluctant to use because undoing it is messy.
//
// The Stripe side is best-effort: if it fails after the database write already succeeded,
// the suspension itself still holds (login is blocked, the profile is hidden) and the
// failure is reported via alertOps rather than rolled back -- a Stripe outage should never
// be the reason a moderation action doesn't take effect at all.
//
// Gated by lib/admin.js's email allowlist, same as the rest of /api/admin.
//
// Admin/owner accounts can never be suspended through this route, enforced here rather
// than only in the dashboard (app/admin/page.js's SuspendControl hides the button, but a
// hidden button is a UI nicety, not a security boundary -- a raw request that skips the
// dashboard entirely would otherwise sail right past it). Checked by email against
// lib/admin.js's own allowlist rather than a separately hardcoded owner id, so this stays
// correct automatically if a second admin is ever added -- no id to remember to update.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin, getAdminEmails } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { paymentProvider } from '@/lib/payments';
import { alertOps } from '@/lib/alerts';

const REASON_MAX = 500;

// Pauses or resumes the Stripe side of a suspension for one creator: their Connect
// payout schedule, plus billing on every one of their currently-active subscriptions.
// Never throws -- each Stripe call is wrapped individually so one failure (a bad account
// id, a subscription Stripe already canceled on its own) can't stop the rest from being
// attempted, and every failure is alerted rather than silently swallowed.
async function applyStripeSuspensionState(userId, suspended) {
  const userResult = await query(
    `SELECT role, stripe_connect_account_id FROM users WHERE id = $1`,
    [userId]
  );
  const target = userResult.rows[0];
  if (!target || target.role !== 'creator') {
    return { payoutsUpdated: false, subscriptionsUpdated: 0, subscriptionsFailed: 0 };
  }

  let payoutsUpdated = false;
  if (target.stripe_connect_account_id) {
    try {
      if (suspended) {
        await paymentProvider.pauseConnectedAccountPayouts({ accountId: target.stripe_connect_account_id });
      } else {
        await paymentProvider.resumeConnectedAccountPayouts({ accountId: target.stripe_connect_account_id });
      }
      payoutsUpdated = true;
    } catch (err) {
      console.error(`admin/users: failed to ${suspended ? 'pause' : 'resume'} payouts for`, userId, err);
      await alertOps(`admin-suspend-payouts-${suspended ? 'pause' : 'resume'}`, err);
    }
  }

  const subsResult = await query(
    `SELECT stripe_subscription_id FROM subscriptions
     WHERE creator_id = $1 AND status = 'active' AND stripe_subscription_id IS NOT NULL`,
    [userId]
  );

  let subscriptionsUpdated = 0;
  let subscriptionsFailed = 0;
  for (const row of subsResult.rows) {
    try {
      if (suspended) {
        await paymentProvider.pauseSubscriptionCollection({ subscriptionId: row.stripe_subscription_id });
      } else {
        await paymentProvider.resumeSubscriptionCollection({ subscriptionId: row.stripe_subscription_id });
      }
      subscriptionsUpdated += 1;
    } catch (err) {
      console.error(`admin/users: failed to ${suspended ? 'pause' : 'resume'} subscription`, row.stripe_subscription_id, err);
      subscriptionsFailed += 1;
    }
  }
  if (subscriptionsFailed > 0) {
    await alertOps(`admin-suspend-subscriptions-${suspended ? 'pause' : 'resume'}`, new Error(
      `${subscriptionsFailed} of ${subsResult.rows.length} subscription(s) failed to ${suspended ? 'pause' : 'resume'} for creator ${userId}`
    ));
  }

  return { payoutsUpdated, subscriptionsUpdated, subscriptionsFailed };
}

export async function PATCH(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('admin-write', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  // The admin account is also a real creator account on ByUs (used to test the creator
  // side of the product) -- without this, a misclick here could suspend the only admin
  // login and lock the team out of /admin entirely, with no other account able to undo it.
  if (params.id === session.userId) {
    return NextResponse.json({ error: "You can't suspend your own account." }, { status: 400 });
  }

  const targetResult = await query('SELECT email FROM users WHERE id = $1', [params.id]);
  const targetEmail = targetResult.rows[0]?.email;
  if (targetEmail && getAdminEmails().includes(targetEmail.toLowerCase())) {
    return NextResponse.json(
      { error: "Admin accounts can't be suspended from this dashboard." },
      { status: 400 }
    );
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

    // Runs after the suspension itself is already committed -- see the file header
    // comment on why the Stripe side is best-effort rather than part of the same
    // all-or-nothing operation.
    const stripeResult = await applyStripeSuspensionState(params.id, is_suspended);

    return NextResponse.json({ user: result.rows[0], stripe: stripeResult });
  } catch (err) {
    console.error('admin/users PATCH failed:', err);
    return NextResponse.json({ error: 'Could not save this change.' }, { status: 500 });
  }
}
