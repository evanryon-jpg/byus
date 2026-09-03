export const dynamic = 'force-dynamic';

// GET /api/auth/google
// Starts the Google OAuth flow: redirects the browser straight to Google's account
// picker / consent screen. Google redirects back to /api/auth/google/callback with an
// authorization code once the person finishes there (or cancels).

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

const STATE_COOKIE_NAME = 'byus_oauth_state';
const STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes — plenty of time to pick a Google account

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);

  const ip = getClientIp(request);
  const rl = await checkRateLimit('oauth', `ip:${ip}`);
  if (!rl.success) return rateLimitResponse(rl);

  // Both env vars must be set in Vercel, on the "byus" project specifically (Production,
  // real values) — see Google Cloud Console > APIs & Services > Credentials.
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', 'Google sign-in isn’t set up yet — use email and password for now.');
    return NextResponse.redirect(url.toString());
  }

  // Only ever carry a same-site path forward through the round trip — identical guard
  // to the one in app/login/page.js and app/signup/page.js, so an open-redirect link
  // can't be smuggled in through ?next=.
  const rawNext = searchParams.get('next') || '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';

  // Only matters if this turns into a brand-new signup in the callback — an existing
  // account always logs in under whatever role it already has.
  const role = searchParams.get('role') === 'creator' ? 'creator' : 'fan';

  // Random, unguessable CSRF token. It rides along in a short-lived httpOnly cookie
  // together with the role/next we need to remember across the trip to Google and
  // back, then gets compared against the `state` Google hands back on the callback —
  // if they don't match, this browser isn't the one that started the flow.
  const state = crypto.randomBytes(24).toString('hex');
  const payload = Buffer.from(JSON.stringify({ state, role, next })).toString('base64url');

  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set('redirect_uri', `${origin}/api/auth/google/callback`);
  googleUrl.searchParams.set('response_type', 'code');
  googleUrl.searchParams.set('scope', 'openid email profile');
  googleUrl.searchParams.set('state', state);
  googleUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(googleUrl.toString());
  response.cookies.set(STATE_COOKIE_NAME, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return response;
}
