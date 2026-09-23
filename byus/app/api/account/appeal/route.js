export const dynamic = 'force-dynamic';

// POST /api/account/appeal
// Public and unauthenticated on purpose: a suspended account can't log in (see
// app/api/auth/login/route.js), so there's no session to gate this behind. Submitted
// from the public /appeal page, which every "you're suspended" surface (the login
// error, the Content Policy, the Creator Agreement) now points to instead of just
// "email support@byusapp.com" — this turns that into a tracked record an admin can
// see in /admin/appeals, tied to the specific suspension it's about, instead of a
// thread buried in an inbox with nothing tracking whether anyone answered it.
//
// Response is deliberately identical whether or not the email matches a real,
// currently-suspended account — same reasoning as the login route's vague "invalid
// email or password": this endpoint must not become a way to check whether a given
// email address has an account on ByUs, let alone whether it's suspended.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { sendAppealReceivedEmail } from '@/lib/email';

const MESSAGE_MAX = 2000;
const GENERIC_RESPONSE = {
  received: true,
  message: "If that's a suspended account, we've received your appeal and will follow up by email.",
};

export async function POST(request) {
  const { email, message } = await request.json().catch(() => ({}));

  if (typeof email !== 'string' || !email.trim() || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Email and a message are required.' }, { status: 400 });
  }
  const trimmedMessage = message.trim().slice(0, MESSAGE_MAX);
  const normalizedEmail = email.trim().toLowerCase();

  const ip = getClientIp(request);
  const ipCheck = await checkRateLimit('appeal', `ip:${ip}`);
  if (!ipCheck.success) return rateLimitResponse(ipCheck);
  const emailCheck = await checkRateLimit('appeal', `email:${normalizedEmail}`);
  if (!emailCheck.success) return rateLimitResponse(emailCheck);

  try {
    const userResult = await query(
      `SELECT id, display_name, email, is_suspended, suspended_at, suspension_reason
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );
    const user = userResult.rows[0];

    // Silently no-op for anything that isn't a real, currently-suspended account —
    // the response is identical either way, so this reveals nothing to the caller.
    if (user && user.is_suspended && user.suspended_at) {
      const existingOpen = await query(
        `SELECT id FROM suspension_appeals
         WHERE user_id = $1 AND suspended_at = $2 AND status = 'open'`,
        [user.id, user.suspended_at]
      );
      if (existingOpen.rows.length === 0) {
        await query(
          `INSERT INTO suspension_appeals
             (user_id, suspended_at, suspension_reason, message, ip_address)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, user.suspended_at, user.suspension_reason, trimmedMessage, ip]
        );
        try {
          await sendAppealReceivedEmail(user.email, { displayName: user.display_name });
        } catch (err) {
          // Best-effort — the appeal itself is already recorded and visible in
          // /admin/appeals even if the confirmation email fails to send.
          console.error('appeal: confirmation email failed to send:', err);
        }
      }
      // An existing open appeal just gets treated as already-received rather than
      // duplicated or erroring — the caller sees the same generic success either way.
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (err) {
    console.error('account/appeal POST failed:', err);
    return NextResponse.json({ error: 'Could not submit your appeal. Try again.' }, { status: 500 });
  }
}
