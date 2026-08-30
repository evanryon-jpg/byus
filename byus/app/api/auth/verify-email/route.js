export const dynamic = 'force-dynamic';

// POST /api/auth/verify-email
// Redeems a verification token sent by /api/auth/signup or /api/auth/resend-verification.
// Mirrors the password-reset token pattern: the raw token lives only in the emailed
// link, and only its sha256 hash is stored, so a database read alone can't produce a
// valid token.

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  const { token } = await request.json();

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing verification token.' }, { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await query(
    `SELECT id, email_verified, verification_token_expires_at
     FROM users WHERE verification_token_hash = $1`,
    [tokenHash]
  );
  const user = result.rows[0];

  if (!user) {
    return NextResponse.json(
      { error: 'This verification link is invalid or has already been used.' },
      { status: 400 }
    );
  }

  if (user.email_verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  if (!user.verification_token_expires_at || new Date(user.verification_token_expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This verification link has expired. Request a new one from your dashboard.' },
      { status: 400 }
    );
  }

  await query(
    `UPDATE users
     SET email_verified = true, verification_token_hash = NULL, verification_token_expires_at = NULL
     WHERE id = $1`,
    [user.id]
  );

  return NextResponse.json({ ok: true });
}
