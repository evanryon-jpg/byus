// Helpers for the "Sign in with Apple" OAuth flow. Apple's token endpoint doesn't take
// a static client secret the way Google's does — it wants a short-lived JWT, signed
// with the private key from your Apple Developer "Sign in with Apple" key, asserting
// who you are (team + Services ID). This module generates that JWT, and separately
// verifies the id_token Apple hands back once someone signs in.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const APPLE_ISSUER = 'https://appleid.apple.com';

// Generated fresh per request rather than cached — it's cheap to produce, and that way
// this never risks handing Apple an expired one.
export function generateAppleClientSecret() {
  // Vercel env vars are single-line, so the PEM's real line breaks get stored as the
  // literal two characters "\n" when pasted in — turn them back into real newlines
  // before handing the key to the signer, or it won't parse as a valid PEM.
  const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    issuer: process.env.APPLE_TEAM_ID,
    subject: process.env.APPLE_CLIENT_ID,
    audience: APPLE_ISSUER,
    expiresIn: 300, // 5 minutes is plenty — this is only ever used once, immediately
    keyid: process.env.APPLE_KEY_ID,
  });
}

// Apple's public signing keys, cached in memory for an hour — they rotate rarely, and
// refetching on every sign-in would be wasteful. A cold serverless instance just
// refetches once, which is fine.
let cachedKeys = null;
let cachedAt = 0;
const KEYS_CACHE_MS = 60 * 60 * 1000;

async function getApplePublicKey(kid) {
  if (!cachedKeys || Date.now() - cachedAt > KEYS_CACHE_MS) {
    const res = await fetch(`${APPLE_ISSUER}/auth/keys`);
    if (!res.ok) throw new Error('Could not fetch Apple public keys');
    const data = await res.json();
    cachedKeys = data.keys;
    cachedAt = Date.now();
  }
  const jwk = cachedKeys.find((k) => k.kid === kid);
  if (!jwk) {
    // Our cache may just be stale (Apple rotated keys) — force one retry with a fresh fetch.
    cachedKeys = null;
    const res = await fetch(`${APPLE_ISSUER}/auth/keys`);
    if (!res.ok) throw new Error('Could not fetch Apple public keys');
    const data = await res.json();
    cachedKeys = data.keys;
    cachedAt = Date.now();
    const retried = cachedKeys.find((k) => k.kid === kid);
    if (!retried) throw new Error('No matching Apple signing key found');
    return crypto.createPublicKey({ key: retried, format: 'jwk' });
  }
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

// Verifies an id_token from Apple: checks its signature against Apple's published keys
// plus issuer/audience, and returns the decoded payload (sub, email, email_verified)
// once it's confirmed genuinely from Apple and meant for this app.
export async function verifyAppleIdToken(idToken) {
  const decodedHeader = jwt.decode(idToken, { complete: true })?.header;
  if (!decodedHeader?.kid) throw new Error('Malformed Apple id_token');

  const publicKey = await getApplePublicKey(decodedHeader.kid);
  return jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: process.env.APPLE_CLIENT_ID,
  });
}
