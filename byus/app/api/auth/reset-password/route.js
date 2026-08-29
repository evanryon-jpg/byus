export const dynamic = 'force-dynamic';

// POST /api/auth/reset-password
// Confirm a password reset: validate the token, set the new password, and
// mark the token used so it can't be replayed.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

// bcrypt silently ignores any bytes past 72 — capping here means the account's real
// password is exactly what the user typed, not a truncated prefix of it.
const PASSWORD_MAX = 72;

export async function POST(request) {
  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (password.length > PASSWORD_MAX) {
    return NextResponse.json(
      { error: `Password must be ${PASSWORD_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  // Rate limit by IP. The token itself is 256 bits of randomness, so brute-forcing it
  // isn't realistic — this is just a general abuse/automation guard on the endpoint.
  const ip = getClientIp(request);
  const ipCheck = await checkRateLimit('reset-password', `ip:${ip}`);
  if (!ipCheck.success) return rateLimitResponse(ipCheck);

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const tokenResult = await query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    const resetToken = tokenResult.rows[0];

    if (!resetToken || resetToken.used_at || new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired. Request a new one.' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(password);

    // Bumping session_version here invalidates every session token issued before this
    // reset — including on other devices, and including whoever's cookie prompted the
    // reset in the first place — the moment it's used, not up to 30 days later.
    await query(
      'UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = now() WHERE id = $2',
      [newHash, resetToken.user_id]
    );
    await query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [resetToken.id]);

    return NextResponse.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (err) {
    console.error('reset-password POST failed:', err);
    return NextResponse.json(
      { error: 'Could not reset your password. Try again.' },
      { status: 500 }
    );
  }
}
