export const dynamic = 'force-dynamic';

// POST /api/auth/reset-password
// Confirm a password reset: validate the token, set the new password, and
// mark the token used so it can't be replayed.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request) {
  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

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

    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      newHash,
      resetToken.user_id,
    ]);
    await query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [resetToken.id]);

    return NextResponse.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (err) {
    console.error('reset-password POST failed:', err);
    return NextResponse.json(
      { error: err.message || 'Could not reset your password. Try again.' },
      { status: 500 }
    );
  }
}
