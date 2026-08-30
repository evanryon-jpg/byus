export const dynamic = 'force-dynamic';

// POST /api/auth/resend-verification
// Session-gated: issues a fresh verification token for the logged-in user and
// emails it, same shape as the token created at signup.

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/email';

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const limitCheck = await checkRateLimit('resend-verification', `user:${session.userId}`);
  if (!limitCheck.success) return rateLimitResponse(limitCheck);

  const existing = await query('SELECT id, email, email_verified FROM users WHERE id = $1', [session.userId]);
  const user = existing.rows[0];
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  if (user.email_verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
  const verifyExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  await query(
    `UPDATE users SET verification_token_hash = $1, verification_token_expires_at = $2 WHERE id = $3`,
    [verifyTokenHash, verifyExpiresAt, user.id]
  );

  try {
    const origin = request.headers.get('origin') || process.env.APP_URL;
    const verifyUrl = `${origin}/verify-email?token=${verifyToken}`;
    await sendVerificationEmail(user.email, verifyUrl);
  } catch (err) {
    console.error('Resend verification email failed:', err);
    return NextResponse.json(
      { error: 'Could not send the verification email right now. Try again shortly.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
