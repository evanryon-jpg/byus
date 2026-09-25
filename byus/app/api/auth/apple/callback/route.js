export const dynamic = 'force-dynamic';

// POST /api/auth/apple/callback
// Apple posts here once the person approves (or declines) access — always a POST with
// a form-encoded body (response_mode=form_post in the initiation route), never a GET
// with query params the way Google's callback works. Exchanges the authorization code
// for tokens, verifies the id_token, then either logs an existing account in, links
// Apple to a matching email/password account, or creates a brand-new account —
// mirroring the same three-way merge the Google callback does.

import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { generateAppleClientSecret, verifyAppleIdToken } from '@/lib/apple-auth';
import { attributeReferral } from '@/lib/referrals';
import { trackServerEvent } from '@/lib/analytics';
import { safeNextPath } from '@/lib/safe-next';
import { recordLegalAcceptance } from '@/lib/legal-acceptance';
import {
  STANDARD_FEE_PERCENT,
  DISCOUNTED_FEE_PERCENT,
  FOUNDING_CREATOR_LIMIT,
} from '@/lib/pricing';

const STATE_COOKIE_NAME = 'byus_oauth_state';
const GENERIC_ERROR = 'Something went wrong signing in with Apple. Please try again.';

// NextResponse.redirect() defaults to a 307, which preserves the original request's
// method -- fine for Google's GET-based callback, but this route only ever receives a
// POST (Apple's response_mode=form_post). A 307 here makes the browser replay that POST
// against whatever page we're redirecting to (/login, /browse, /creator/dashboard), and
// since none of those are POST-handling routes, that replay 405s instead of rendering.
// 303 (See Other) is the standard fix for a POST-then-redirect: it always downgrades the
// follow-up request to a GET regardless of the original method.
const REDIRECT_STATUS = 303;

function loginErrorRedirect(origin, message) {
  const url = new URL('/login', origin);
  url.searchParams.set('error', message);
  const response = NextResponse.redirect(url.toString(), REDIRECT_STATUS);
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
    const response = NextResponse.redirect(new URL('/login', origin).toString(), REDIRECT_STATUS);
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
  const next = safeNextPath(saved.next);
  const referralCode = typeof saved.referralCode === 'string' ? saved.referralCode : '';
  const acquisitionSource = saved.acquisitionSource === 'instagram' ? 'instagram' : null;

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
  let accountCreated = false;
  try {
    // 1. Already linked — the common case for every login after the first.
    const bySub = await query(
      'SELECT id, email, role, display_name, session_version, is_suspended FROM users WHERE apple_sub = $1',
      [payload.sub]
    );
    user = bySub.rows[0];

    if (!user) {
      // 2. Not linked yet, but the email matches an existing account — Apple has
      // already proven this person owns the address, so it's safe to attach
      // apple_sub to that account instead of erroring out or duplicating it.
      const byEmail = await query(
        'SELECT id, email, role, display_name, session_version, is_suspended, email_verified FROM users WHERE email = $1',
        [email]
      );
      if (byEmail.rows[0]) {
      // If the existing account never verified its email, whoever created it never proved
      // they own the address -- anyone can sign up with someone else's email. Linking it to
      // the real owner's Google/Apple identity must not let that earlier registrant keep a
      // way in, so the password is cleared and every existing session revoked
      // (session_version bump). A verified account keeps its password: its owner already
      // proved the address.
        const updated = await query(
          `UPDATE users
           SET apple_sub = $1, email_verified = true,
               display_name = COALESCE(display_name, $2),
               password_hash = CASE WHEN email_verified THEN password_hash ELSE NULL END,
               session_version = CASE WHEN email_verified THEN session_version ELSE session_version + 1 END,
               updated_at = now()
           WHERE id = $3
           RETURNING id, email, role, display_name, session_version, is_suspended`,
          [payload.sub, displayName, byEmail.rows[0].id]
        );
        user = updated.rows[0];
      } else {
        if (!saved.legalAccepted || !saved.legalDocuments) {
          const signupUrl = new URL('/signup', origin);
          signupUrl.searchParams.set('error', 'Please accept the Terms of Service and Privacy Policy before creating an account.');
          return NextResponse.redirect(signupUrl.toString(), REDIRECT_STATUS);
        }
        // 3. Brand new person — create the account with the role the flow started
        // with (fan by default, or creator if they clicked Apple from the creator
        // signup tab).
        //
        // The advisory lock below serializes this INSERT's founding-creator COUNT check
        // against every other concurrent creator signup -- across this callback, the
        // Google callback, and the email/password signup route, all keyed on the same
        // fixed lock name -- so a burst of simultaneous signups can't all read the count
        // as still under FOUNDING_CREATOR_LIMIT and over-qualify for the discounted rate.
        user = await withTransaction(async (client) => {
          await client.query(`SELECT pg_advisory_xact_lock(hashtext('byus_founding_creator_signup'))`);
          const created = await client.query(
            `INSERT INTO users (
               email, role, display_name,
               apple_sub, email_verified, terms_accepted_at, platform_fee_percent, acquisition_source
             )
             VALUES (
               $1, $2, $3, $4, true, now(),
               -- Cast to integer: with both branches bare parameters, Postgres can't infer a
               -- type for the CASE expression itself (it resolves that independently of the
               -- INSERT target column) and falls back to text, which then fails to assign into
               -- this integer column. Confirmed in production: every new-account creation
               -- through this path was failing with "column platform_fee_percent is of type
               -- integer but expression is of type text" until this cast was added.
               (CASE
                 WHEN $2 = 'creator' AND (SELECT COUNT(*) FROM users WHERE role = 'creator') < $5 THEN $6
                 ELSE $7
               END)::integer,
               $8
             )
             RETURNING id, email, role, display_name, session_version`,
            [
              email, role, displayName, payload.sub,
              FOUNDING_CREATOR_LIMIT, DISCOUNTED_FEE_PERCENT, STANDARD_FEE_PERCENT,
              acquisitionSource,
            ]
          );
          const createdUser = created.rows[0];
          await recordLegalAcceptance(client, {
            userId: createdUser.id,
            role: createdUser.role,
            source: 'apple_signup',
            request,
            documents: saved.legalDocuments,
          });
          return createdUser;
        });
        accountCreated = true;
        await attributeReferral(referralCode, user.id);
      }
    }
  } catch (err) {
    console.error('Apple sign-in database error:', err);
    return loginErrorRedirect(origin, GENERIC_ERROR);
  }

  // Only ever true for an existing account (a brand-new signup can't already be
  // suspended) -- same rule the password login route enforces, just on this path too,
  // since Apple sign-in mints a session cookie directly and never goes through
  // /api/auth/login at all.
  if (user.is_suspended) {
    return loginErrorRedirect(
      origin,
      'This account has been suspended. Contact support@byusapp.com if you believe this is a mistake.'
    );
  }

  const token = createSessionToken(user);
  const destination = next || (user.role === 'creator' ? '/creator/dashboard' : '/browse');
  const response = NextResponse.redirect(new URL(destination, origin).toString(), REDIRECT_STATUS);
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  response.cookies.set(STATE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  if (accountCreated) {
    await trackServerEvent(
      'funnel_account_created',
      { role: user.role, provider: 'apple', source: acquisitionSource || 'unattributed' },
      request
    );
  }
  return response;
}
