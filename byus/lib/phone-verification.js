// Phone-number verification for SMS notifications (see
// database/migrations/20260919_sms_notifications.sql). A fan requests a 6-digit code,
// gets it by text via lib/sms.js, and confirms it -- proving they actually control the
// number before users.phone/phone_verified_at are trusted for anything.
//
// The code is hashed at rest (HMAC-SHA256, keyed by JWT_SECRET) rather than stored in
// plaintext -- same reasoning as getTelegramWebhookSecret in lib/telegram.js for
// deriving a secret from JWT_SECRET instead of a new env var, though the threat model
// here is different: a 6-digit code is only ~1M possibilities, so the real defense
// against guessing is CODE_MAX_ATTEMPTS + expiry below, not the hash itself. Hashing
// still means a read-only leak of this table alone can't be used directly.

import crypto from 'crypto';
import { query } from '@/lib/db';
import { sendSmsToOne } from '@/lib/sms';

const CODE_TTL_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;

function hashCode(userId, code) {
  const base = process.env.JWT_SECRET;
  if (!base) throw new Error('JWT_SECRET is not set.');
  return crypto.createHmac('sha256', base).update(`phone-verify:${userId}:${code}`).digest('hex');
}

// Loose E.164 check: a leading + then 8-15 digits. Good enough to reject obviously
// malformed input before it ever reaches sent.dm, which will reject anything it can't
// route anyway -- this isn't trying to be a full libphonenumber-grade validator.
export function isValidE164(phone) {
  return typeof phone === 'string' && /^\+[1-9]\d{7,14}$/.test(phone);
}

// Generates a code, stores its hash, and texts it to `phone`. Returns { ok: true } or
// { ok: false, error }. Does not touch users.phone -- that only happens on a
// successful verifyPhoneCode, so a fan can request codes for several numbers (typos,
// changed their mind) without any of them being "half-connected" in the meantime.
export async function sendPhoneVerificationCode(userId, phone) {
  if (!isValidE164(phone)) {
    return { ok: false, error: 'Enter a valid phone number, including country code (e.g. +14155551234).' };
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = hashCode(userId, code);

  await query(
    `INSERT INTO phone_verification_codes (user_id, phone, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '${CODE_TTL_MINUTES} minutes')`,
    [userId, phone, codeHash]
  );

  const result = await sendSmsToOne(phone, `Your ByUs verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`);
  if (!result.ok) {
    return { ok: false, error: 'Could not send the verification text. Double-check the number and try again.' };
  }
  return { ok: true };
}

// Checks `code` against this user's most recent still-live code for `phone`. On
// success, marks that row consumed and returns { ok: true } -- the caller (the
// /verify route) is what actually updates users.phone/phone_verified_at, since that's
// an account mutation this module shouldn't own.
export async function verifyPhoneCode(userId, phone, code) {
  const result = await query(
    `SELECT id, code_hash, attempts, expires_at, consumed_at
     FROM phone_verification_codes
     WHERE user_id = $1 AND phone = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, phone]
  );
  const row = result.rows[0];
  if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) {
    return { ok: false, error: 'That code has expired. Request a new one.' };
  }
  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many incorrect attempts. Request a new code.' };
  }

  if (hashCode(userId, String(code || '')) !== row.code_hash) {
    await query(`UPDATE phone_verification_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    return { ok: false, error: 'That code is incorrect.' };
  }

  await query(`UPDATE phone_verification_codes SET consumed_at = now() WHERE id = $1`, [row.id]);
  return { ok: true };
}
