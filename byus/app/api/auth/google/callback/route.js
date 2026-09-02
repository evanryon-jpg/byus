export const dynamic = 'force-dynamic';

// GET /api/auth/google/callback
// Google redirects here once the person approves (or declines) access. Exchanges the
// authorization code for a profile, then either logs an existing account in, links
// Google to a matching email/password account, or creates a brand-new account —
// mirroring the "log in / sign up" merge the rest of the onboarding flow already does.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

const STATE_COOKIE_NAME = 'byus_oauth_state';
const GENERIC_ERROR = 'Something went wrong signing in with Google. Please try again.';

function loginErrorRedirect(origin, message) {
  const url = new URL('/login', origin);
  url.searchParams.set('error', message);
  const response = NextResponse.redirect(url.toString());
  response.cookies.set(STATE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);

  const ip = getClientIp(request);
  const rl = await checkRateLimit('oauth', `ip:${ip}`);
  if (!rl.success) return rateLimitResponse(rl);

  // The person declined on Google's consent screen, or Google sent some other error —
  // either way, send them back to a normal login rather than a broken page.
  if (searchParams.get('error')) {
    const response = NextResponse.redirect(new URL('/login', origin).toString());
    response.cookies.set(STATE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
    return response;
  }

  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
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

  // --- Exchange the authorization code for tokens ---
  let tokenData;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
    }
  } catch (err) {
    console.error('Google token exchange failed:', err);
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  // --- Fetch the person's Google profile ---
  let profile;
  try {
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    profile = await profileRes.json();
    if (!profileRes.ok || !profile.sub) {
      throw new Error('Profile fetch failed');
    }
  } catch (err) {
    console.error('Google profile fetch failed:', err);
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  // Google's own attestation that this address is really controlled by this account —
  // without it, someone could add an unverified email to their Google account and use
  // it to claim (or create) a ByUs account that isn't theirs.
  if (!profile.email || !profile.email_verified) {
    return loginErrorRedirect(
      origin,
      'Your Google email isn’t verified yet. Please verify it with Google and try again.'
    );
  }

  const email = profile.email.toLowerCase();
  const displayName = profile.name || null;
  const profileImageUrl = profile.picture || null;

  let user;
  try {
    // 1. Already linked — the common case for every login after the first.
    const bySub = await query(
      'SELECT id, email, role, display_name, session_version FROM users WHERE google_sub = $1',
      [profile.sub]
    );
    user = bySub.rows[0];

    if (!user) {
      // 2. Not linked yet, but the email matches an existing account — Google has
      // already proven this person owns the address, so it's safe to attach
      // google_sub to that account instead of erroring out or duplicating it.
      const byEmail = await query(
        'SELECT id, email, role, display_name, session_version FROM users WHERE email = $1',
        [email]
      );
      if (byEmail.rows[0]) {
        const updated = await query(
          `UPDATE users
           SET google_sub = $1, email_verified = true,
               profile_image_url = COALESCE(profile_image_url, $2),
               updated_at = now()
           WHERE id = $3
           RETURNING id, email, role, display_name, session_version`,
          [profile.sub, profileImageUrl, byEmail.rows[0].id]
        );
        user = updated.rows[0];
      } else {
        // 3. Brand new person — create the account with the role the flow started
        // with (fan by default, or creator if they clicked Google from the creator
        // signup tab).
        const created = await query(
          `INSERT INTO users (
             email, role, display_name, profile_image_url,
             google_sub, email_verified, terms_accepted_at
           )
           VALUES ($1, $2, $3, $4, $5, true, now())
           RETURNING id, email, role, display_name, session_version`,
          [email, role, displayName, profileImageUrl, profile.sub]
        );
        user = created.rows[0];
      }
    }
  } catch (err) {
    console.error('Google sign-in database error:', err);
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  const token = createSessionToken(user);
  const destination = next || (user.role === 'creator' ? '/creator/dashboard' : '/browse');
  const response = NextResponse.redirect(new URL(destination, origin).toString());
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  response.cookies.set(STATE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return response;
}
