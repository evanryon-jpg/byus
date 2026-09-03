export const dynamic = 'force-dynamic';

// GET /api/auth/apple
// Starts the "Sign in with Apple" flow: redirects the browser straight to Apple's
// account picker / consent screen. Apple posts back to /api/auth/apple/callback once
// the person finishes there (or cancels) — as a POST, not the GET Google's callback
// uses, which is why the state cookie below is SameSite=None instead of Lax.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

const STATE_COOKIE_NAME = 'byus_oauth_state';
const STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes — plenty of time to pick an Apple ID

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);

  const ip = getClientIp(request);
  const rl = await checkRateLimit('oauth', `ip:${ip}`);
  if (!rl.success) return rateLimitResponse(rl);

  // All four must be set in Vercel (Production, real values from a paid Apple Developer
  // Program account — a Services ID, Team ID, Key ID, and private key) for this to
  // proceed past here. See lib/apple-auth.js for what each one is used for.
  if (
    !process.env.APPLE_CLIENT_ID ||
    !process.env.APPLE_TEAM_ID ||
    !process.env.APPLE_KEY_ID ||
    !process.env.APPLE_PRIVATE_KEY
  ) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', 'Apple sign-in isn’t set up yet — use email and password for now.');
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

  // Same deal — only matters for a brand-new signup in the callback, so a referral
  // link (/signup?ref=CODE) that routes through "Continue with Apple" still gets
  // attributed instead of silently dropping the referral.
  const referralCode = searchParams.get('ref') || '';

  // Random, unguessable CSRF token. It rides along in a short-lived httpOnly cookie
  // together with the role/next/ref we need to remember across the trip to Apple and
  // back, then gets compared against the `state` Apple hands back on the callback —
  // if they don't match, this browser isn't the one that started the flow.
  const state = crypto.randomBytes(24).toString('hex');
  const payload = Buffer.from(JSON.stringify({ state, role, next, referralCode })).toString('base64url');

  const appleUrl = new URL('https://appleid.apple.com/auth/authorize');
  appleUrl.searchParams.set('client_id', process.env.APPLE_CLIENT_ID);
  appleUrl.searchParams.set('redirect_uri', `${origin}/api/auth/apple/callback`);
  appleUrl.searchParams.set('response_type', 'code');
  // Required to be "form_post" whenever the request includes name/email scopes — Apple
  // only ever includes the person's name on this first POST, which can't ride along on
  // a plain redirect the way Google's response_mode does.
  appleUrl.searchParams.set('response_mode', 'form_post');
  appleUrl.searchParams.set('scope', 'name email');
  appleUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(appleUrl.toString());
  response.cookies.set(STATE_COOKIE_NAME, payload, {
    httpOnly: true,
    // SameSite=None requires Secure, and is required here for a different reason too:
    // Apple's callback arrives as a cross-site POST from appleid.apple.com, and a
    // SameSite=Lax cookie (fine for Google's GET-redirect callback) is silently
    // dropped on a cross-site POST — the state check would fail for every real user.
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return response;
}
