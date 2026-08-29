export const dynamic = 'force-dynamic';

// POST /api/auth/signup
// Creates a new user account as either a 'creator' or 'fan'.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

// Deliberately permissive — this is a sanity check (one "@", something on both sides,
// a dot somewhere in the domain), not full RFC 5322 validation, which would reject
// plenty of real addresses. Actual deliverability can only ever be confirmed by
// sending mail, not by a regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254; // RFC 5321 mailbox length limit
const DISPLAY_NAME_MAX = 100;
// bcrypt silently ignores any bytes past 72 — capping here means the account's real
// password is exactly what the user typed, not a truncated prefix of it.
const PASSWORD_MAX = 72;

export async function POST(request) {
  const { email, password, role, displayName } = await request.json();

  // --- Basic validation ---
  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Email, password, and role are required.' }, { status: 400 });
  }
  if (!['creator', 'fan'].includes(role)) {
    return NextResponse.json({ error: 'Role must be either "creator" or "fan".' }, { status: 400 });
  }
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
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
  if (displayName && displayName.length > DISPLAY_NAME_MAX) {
    return NextResponse.json(
      { error: `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  // Rate limit by IP to slow down mass/bot account creation.
  const ip = getClientIp(request);
  const ipCheck = await checkRateLimit('signup', `ip:${ip}`);
  if (!ipCheck.success) return rateLimitResponse(ipCheck);

  // --- Check for existing account ---
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  // --- Create the user ---
  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (email, password_hash, role, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, role, display_name, session_version`,
    [email.toLowerCase(), passwordHash, role, displayName || null]
  );
  const user = result.rows[0];

  // --- Log them in immediately by setting a session cookie ---
  const token = createSessionToken(user);
  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
