export const dynamic = 'force-dynamic';

// POST /api/auth/forgot-password
// Request a password reset link. Always responds with the same generic message,
// whether or not the email belongs to a real account — this avoids leaking which
// emails are registered (user enumeration).

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_MESSAGE = "If an account exists for that email, we've sent a password reset link.";

export async function POST(request) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  // Rate limit by IP and by the target email — this endpoint sends a real email
  // through Resend on every hit, so unlike most rate limits this one is also a cost
  // and harassment guard (someone repeatedly reset-emailing a stranger), not just an
  // abuse guard. A 429 here doesn't leak whether the account exists, since it's
  // checked before any DB lookup and applies the same whether or not it does.
  const ip = getClientIp(request);
  const ipCheck = await checkRateLimit('forgot-password', `ip:${ip}`);
  if (!ipCheck.success) return rateLimitResponse(ipCheck);
  const emailCheck = await checkRateLimit('forgot-password', `email:${email.toLowerCase()}`);
  if (!emailCheck.success) return rateLimitResponse(emailCheck);

  try {
    const userResult = await query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = userResult.rows[0];

    // Only actually do anything if the account exists — but always return the same
    // response either way, so the response itself can't be used to enumerate emails.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      const origin = request.headers.get('origin') || process.env.APP_URL;
      const resetUrl = `${origin}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail(user.email, resetUrl);
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (err) {
    console.error('forgot-password POST failed:', err);
    // Still don't leak whether the account exists — just report that something went
    // wrong sending it, without specifics.
    return NextResponse.json(
      { error: 'Could not process this request right now. Try again shortly.' },
      { status: 500 }
    );
  }
}
