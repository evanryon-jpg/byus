export const dynamic = 'force-dynamic';

// POST /api/auth/signup
// Creates a new user account as either a 'creator' or 'fan'.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  const { email, password, role, displayName } = await request.json();

  // --- Basic validation ---
  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Email, password, and role are required.' }, { status: 400 });
  }
  if (!['creator', 'fan'].includes(role)) {
    return NextResponse.json({ error: 'Role must be either "creator" or "fan".' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

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
     RETURNING id, email, role, display_name`,
    [email.toLowerCase(), passwordHash, role, displayName || null]
  );
  const user = result.rows[0];

  // --- Log them in immediately by setting a session cookie ---
  const token = createSessionToken(user);
  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
