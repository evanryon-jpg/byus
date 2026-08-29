export const dynamic = 'force-dynamic';

// PATCH /api/me/password
// Changes the currently logged-in user's password. Requires the current
// password to be re-entered, same as the initial signup convention (bcrypt,
// via lib/auth.js) so we don't need any new hashing logic.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

// bcrypt silently ignores any bytes past 72 — capping here means the account's real
// password is exactly what the user typed, not a truncated prefix of it.
const PASSWORD_MAX = 72;

export async function PATCH(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  // Rate limit by user — this endpoint checks a live password, so a hijacked session
  // token could otherwise be used to brute-force the account's real password with no
  // friction. Same risk shape as login, just reached through an authenticated session
  // instead of the login form.
  const rateCheck = await checkRateLimit('password-change', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Current and new password are both required.' },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }
  if (newPassword.length > PASSWORD_MAX) {
    return NextResponse.json(
      { error: `New password must be ${PASSWORD_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  try {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [session.userId]);
    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const matches = await verifyPassword(currentPassword, user.password_hash);
    if (!matches) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);
    // Bumping session_version invalidates every other session immediately — including a
    // stolen cookie an attacker might be using elsewhere right now — rather than leaving
    // them valid for up to 30 more days.
    await query(
      'UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2',
      [newHash, session.userId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('me/password PATCH failed:', err);
    return NextResponse.json(
      { error: 'Could not change your password. Try again.' },
      { status: 500 }
    );
  }
}
