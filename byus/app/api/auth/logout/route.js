export const dynamic = 'force-dynamic';

// POST /api/auth/logout — clears the session cookie

import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Reuse the same cookie options login/signup set (path, sameSite, secure) with maxAge
  // overridden to 0 — clearing a cookie only actually clears it if every other attribute
  // matches what set it, so hand-rolling a separate options object here risks silently
  // failing to clear the cookie if those two ever drift apart.
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...getSessionCookieOptions(), maxAge: 0 });
  return response;
}
