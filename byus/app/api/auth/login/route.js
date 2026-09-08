export const dynamic = 'force-dynamic';

// POST /api/auth/login

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword, createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // Rate limit by IP (catches credential-stuffing bots working through many accounts)
  // and separately by the email being tried (catches focused brute-forcing of one
  // account spread across many IPs).
  const ip = getClientIp(request);
  const ipCheck = await checkRateLimit('login', `ip:${ip}`);
  if (!ipCheck.success) return rateLimitResponse(ipCheck);
  const emailCheck = await checkRateLimit('login', `email:${email.toLowerCase()}`);
  if (!emailCheck.success) return rateLimitResponse(emailCheck);

  const result = await query(
    `SELECT id, email, password_hash, role, display_name, session_version, is_suspended
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  const user = result.rows[0];

  // Deliberately vague error message — don't reveal whether the email exists,
  // which would let an attacker enumerate registered accounts.
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  // An account created (or since linked) through Google sign-in has no password_hash
  // at all — bcrypt.compare would throw on a null hash. Same vague message as any
  // other mismatch, so this doesn't leak that the account is Google-only.
  if (!user.password_hash) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  // Checked only after the password has already been confirmed correct -- same reasoning
  // as the vague "invalid email or password" message above, just in the other direction.
  // Someone who doesn't know the password learns nothing extra; someone who does gets a
  // clear, specific reason they can't get in rather than a session that silently never works.
  if (user.is_suspended) {
    return NextResponse.json(
      { error: 'This account has been suspended. Contact evanryon@yahoo.com if you believe this is a mistake.' },
      { status: 403 }
    );
  }

  const token = createSessionToken(user);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, display_name: user.display_name },
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
