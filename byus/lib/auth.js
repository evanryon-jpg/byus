// Authentication helpers: password hashing and session tokens.
// Sessions are stored as a JWT in an httpOnly cookie, so the browser can't read or tamper with it.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET; // set this in .env.local — a long random string
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
export function createSessionToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
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
