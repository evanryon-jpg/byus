// Authentication helpers: password hashing and session tokens.
// Sessions are stored as a JWT in an httpOnly cookie, so the browser can't read or tamper with it.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET; // set this in .env.local — a long random string

// Fail loudly and immediately if this is missing, instead of silently signing and verifying
// every session token against `undefined`. A misconfigured environment (a preview deploy
// missing the env var, a typo'd name) would otherwise look like it's working — every token
// it issues would also happily verify against the same undefined secret — right up until it
// talks to an environment that DOES have JWT_SECRET set correctly, where none of those
// tokens are valid.
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Set it in your environment before starting the app.');
}

const SESSION_COOKIE_NAME = 'byus_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

export async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

// Create a signed session token for a given user. Store only what's needed to identify
// the user + their role — never put sensitive data (like password hashes) in here, since
// JWTs are readable (not encrypted) by anyone who has the token, they're just tamper-proof.
//
// `sessionVersion` is what makes revocation possible for an otherwise-stateless JWT: it's
// checked against the user's current `session_version` in the database on every request
// (see lib/session.js). Bumping that column — e.g. on a password change — instantly
// invalidates every token issued before the bump, without maintaining a token/session
// table. Defaults to 1 so callers that only have a freshly-inserted user row (which may not
// have selected the column back) still issue a valid token.
export function createSessionToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, sessionVersion: user.session_version ?? 1 },
    JWT_SECRET,
    { expiresIn: SESSION_MAX_AGE_SECONDS }
  );
}

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null; // invalid or expired token
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true, // JS on the page can't read this cookie — protects against XSS token theft
    secure: process.env.NODE_ENV === 'production', // only sent over HTTPS in production
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export { SESSION_COOKIE_NAME };
