export const dynamic = 'force-dynamic';

// POST /api/auth/login

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword, createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const result = await query(
    'SELECT id, email, password_hash, role, display_name FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = result.rows[0];

  // Deliberately vague error message — don't reveal whether the email exists,
  // which would let an attacker enumerate registered accounts.
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const token = createSessionToken(user);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, display_name: user.display_name },
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
