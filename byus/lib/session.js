// Helper for API routes: read the session cookie from an incoming request
// and return the logged-in user's info (or null if not logged in / invalid session).

import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE_NAME } from './auth';
import { query } from './db';

export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = verifySessionToken(token); // { userId, email, role, sessionVersion } or null
  if (!claims) return null;

  // Revocation check: the JWT's signature proves it hasn't been tampered with, but a
  // stateless token has no way to be "un-issued" once someone has it — a stolen cookie
  // would otherwise stay valid for its full 30-day lifetime no matter what the account
  // owner does. Comparing the token's embedded sessionVersion against the user's current
  // session_version closes that gap: bumping the column (done on every password change)
  // instantly invalidates every token issued before the bump. Fails closed on any error —
  // if we can't confirm a session is still valid, treat it as not logged in.
  try {
    const result = await query('SELECT session_version FROM users WHERE id = $1', [claims.userId]);
    const user = result.rows[0];
    if (!user || user.session_version !== claims.sessionVersion) return null;
  } catch (err) {
    console.error('Session revocation check failed:', err);
    return null;
  }

  return claims;
}
