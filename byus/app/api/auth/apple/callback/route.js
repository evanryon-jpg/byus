export const dynamic = 'force-dynamic';

// POST /api/auth/apple/callback
// Apple posts here once the person approves (or declines) access — always a POST with
// a form-encoded body (response_mode=form_post in the initiation route), never a GET
// with query params the way Google's callback works. Exchanges the authorization code
// for tokens, verifies the id_token, then either logs an existing account in, links
// Apple to a matching email/password account, or creates a brand-new account —
// mirroring the same three-way merge the Google callback does.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { generateAppleClientSecret, verifyAppleIdToken } from '@/lib/apple-auth';
import { attributeReferral } from '@/lib/referrals';

const STATE_COOKIE_NAME = 'byus_oauth_state';
const GENERIC_ERROR = 'Something went wrong signing in with Apple. Please try again.';

function loginErrorRedirect(origin, message) {
  const url = new URL('/login', origin);
  url.searchParams.set('error', message);
  const response = NextResponse.redirect(url.toString());
  response.cookies.set(STATE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}

export async function POST(request) {
  const { origin } = new URL(request.url);

  const ip = getClientIp(request);
  const rl = await checkRateLimit('oauth', `ip:${ip}`);
  if (!rl.success) return rateLimitResponse(rl);

  let form;
  try {
    form = await request.formData();
  } catch {
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  // The person declined on Apple's consent screen, or Apple sent some other error —
  // either way, send them back to a normal login rather than a broken page.
  if (form.get('error')) {
    const response = NextResponse.redirect(new URL('/login', origin).toString());
    response.cookies.set(STATE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
    return response;
  }

  const code = form.get('code');
  const returnedState = form.get('state');
  const cookiePayload = request.cookies.get(STATE_COOKIE_NAME)?.value;

  if (!code || !returnedState || !cookiePayload) {
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  let saved;
  try {
    saved = JSON.parse(Buffer.from(cookiePayload, 'base64url').toString('utf8'));
  } catch {
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  // The state cookie is httpOnly and short-lived, and this comparison is what proves
  // the browser completing the flow is the same one that started it — without it, a
  // forged callback request could log an attacker's session in as anyone.
  if (!saved.state || saved.state !== returnedState) {
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  const role = saved.role === 'creator' ? 'creator' : 'fan';
  const next =
    typeof saved.next === 'string' && saved.next.startsWith('/') && !saved.next.startsWith('//')
      ? saved.next
      : '';
  const referralCode = typeof saved.referralCode === 'string' ? saved.referralCode : '';

  // --- Exchange the authorization code for tokens ---
  let tokenData;
  try {
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.APPLE_CLIENT_ID,
        client_secret: generateAppleClientSecret(),
        redirect_uri: `${origin}/api/auth/apple/callback`,
        grant_type: 'authorization_code',
      }),
    });
    tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
    }
  } catch (err) {
    console.error('Apple token exchange failed:', err);
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  // --- Verify the id_token Apple just issued (signature, issuer, audience) ---
  let payload;
  try {
    payload = await verifyAppleIdToken(tokenData.id_token);
    if (!payload?.sub) throw new Error('Missing sub claim');
  } catch (err) {
    console.error('Apple id_token verification failed:', err);
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  // Apple's own attestation that this address is really controlled by this account.
  // `email_verified` on Apple's tokens sometimes comes through as the string "true"
  // rather than a boolean, depending on client — normalize before checking it.
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (!payload.email || !emailVerified) {
    return loginErrorRedirect(
      origin,
      'Your Apple email isn’t verified yet. Please verify it with Apple and try again.'
    );
  }

  const email = payload.email.toLowerCase();

  // Apple only ever sends the person's name once, on the very first authorization —
  // every sign-in after that omits the 'user' field entirely, so this is best-effort.
  let displayName = null;
  const userField = form.get('user');
  if (userField) {
    try {
      const parsedUser = JSON.parse(userField);
      const first = parsedUser?.name?.firstName || '';
      const last = parsedUser?.name?.lastName || '';
      displayName = [first, last].filter(Boolean).join(' ') || null;
    } catch {
      // Malformed 'user' field — not fatal, just proceed without a name.
    }
  }

  let user;
  try {
    // 1. Already linked — the common case for every login after the first.
    const bySub = await query(
      'SELECT id, email, role, display_name, session_version FROM users WHERE apple_sub = $1',
      [payload.sub]
    );
    user = bySub.rows[0];

    if (!user) {
      // 2. Not linked yet, but the email matches an existing account — Apple has
      // already proven this person owns the address, so it's safe to attach
      // apple_sub to that account instead of erroring out or duplicating it.
      const byEmail = await query(
        'SELECT id, email, role, display_name, session_version FROM users WHERE email = $1',
        [email]
      );
      if (byEmail.rows[0]) {
        const updated = await query(
          `UPDATE users
           SET apple_sub = $1, email_verified = true,
               display_name = COALESCE(display_name, $2),
               updated_at = now()
           WHERE id = $3
           RETURNING id, email, role, display_name, session_version`,
          [payload.sub, displayName, byEmail.rows[0].id]
        );
        user = updated.rows[0];
      } else {
        // 3. Brand new person — create the account with the role the flow started
        // with (fan by default, or creator if they clicked Apple from the creator
        // signup tab).
        const created = await query(
          `INSERT INTO users (
             email, role, display_name,
             apple_sub, email_verified, terms_accepted_at
           )
           VALUES ($1, $2, $3, $4, true, now())
           RETURNING id, email, role, display_name, session_version`,
          [email, role, displayName, payload.sub]
        );
        user = created.rows[0];
        await attributeReferral(referralCode, user.id);
      }
    }
  } catch (err) {
    console.error('Apple sign-in database error:', err);
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  const token = createSessionToken(user);
  const destination = next || (user.role === 'creator' ? '/creator/dashboard' : '/browse');
  const response = NextResponse.redirect(new URL(destination, origin).toString());
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  response.cookies.set(STATE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}
