export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/admin/waitlist/notify-reopen
// Reopening day: emails everyone on the creator waitlist a link to create their account
// (lib/email.js sendSignupsReopenedEmail), with their founding spot number if they have
// one. Driven by the "Email the waitlist" button in app/admin/AdminClient.js.
//
// Guard rails:
//   - Refuses while CREATOR_SIGNUP_PAUSED is still true (lib/creator-signup.js). The email
//     says "signups are open" and links to /signup -- sending it before that's true would
//     send people to a page that just puts them back on the waitlist.
//   - Each entry is emailed at most once: founding_waitlist.reopen_notified_at is claimed
//     with a conditional UPDATE before sending and released again if the send fails, so
//     pressing the button twice (or again after a partial failure) only reaches the people
//     who haven't been emailed yet.
//   - Skips anyone who already has a creator account -- they don't need the nudge.
//   - Only emails people in countries where creator accounts are open. At launch that's
//     the US (plus entries from before the country field existed, which are US); UK /
//     Europe / Canada reservations wait for their own email (lib/creator-countries.js).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { CREATOR_SIGNUP_PAUSED } from '@/lib/creator-signup';
import { sendSignupsReopenedEmail } from '@/lib/email';
import { LAUNCH_COUNTRIES } from '@/lib/creator-countries';

const MAX_PER_REQUEST = 200;

export async function POST() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (CREATOR_SIGNUP_PAUSED) {
    return NextResponse.json(
      { error: 'Creator signups are still paused. Reopen them first, then send this email.' },
      { status: 409 }
    );
  }

  const pending = await query(
    `SELECT w.id, w.email, w.display_name, fr.spot_number
     FROM founding_waitlist w
     LEFT JOIN founding_reservations fr ON lower(fr.email) = lower(w.email)
     WHERE w.reopen_notified_at IS NULL
       AND (w.country IS NULL OR w.country = ANY($2))
       AND NOT EXISTS (
         SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email) AND u.role = 'creator'
       )
     ORDER BY w.created_at ASC
     LIMIT $1`,
    [MAX_PER_REQUEST, LAUNCH_COUNTRIES]
  );

  const appUrl = process.env.APP_URL || 'https://byusapp.com';
  const signupUrl = `${appUrl}/signup?role=creator`;
  let sent = 0;
  let failed = 0;

  for (const entry of pending.rows) {
    const claim = await query(
      `UPDATE founding_waitlist SET reopen_notified_at = now()
       WHERE id = $1 AND reopen_notified_at IS NULL RETURNING id`,
      [entry.id]
    );
    if (claim.rows.length === 0) continue; // another click got here first

    try {
      await sendSignupsReopenedEmail(entry.email, {
        displayName: entry.display_name,
        foundingSpot: entry.spot_number,
        signupUrl,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error('notify-reopen: send failed for one waitlist entry (will retry next press):', err);
      await query('UPDATE founding_waitlist SET reopen_notified_at = NULL WHERE id = $1', [entry.id]).catch(() => {});
    }
  }

  const remainingResult = await query(
    `SELECT COUNT(*)::int AS n FROM founding_waitlist w
     WHERE w.reopen_notified_at IS NULL
       AND (w.country IS NULL OR w.country = ANY($1))
       AND NOT EXISTS (
         SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email) AND u.role = 'creator'
       )`,
    [LAUNCH_COUNTRIES]
  );

  return NextResponse.json({ sent, failed, remaining: remainingResult.rows[0]?.n || 0 });
}
