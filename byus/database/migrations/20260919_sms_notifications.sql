-- Lets a fan opt into a text message when a creator they're subscribed to publishes a
-- new post, alongside the existing users.notify_new_posts email toggle (see
-- app/api/creator/posts/route.js's notifySubscribersOfNewPost). Delivery goes through
-- sent.dm (lib/sms.js).
--
-- A phone number only becomes usable once verified: a fan enters a number, gets a
-- 6-digit code (lib/phone-verification.js), and confirms it before `phone` is trusted
-- for anything. That's a different handshake than Telegram/Discord's deep-link connect
-- (see database/migrations/20260915_telegram_link_tokens.sql) because SMS has no
-- equivalent of "the bot can only message someone who messaged it first" -- the
-- verification step here is what proves the fan actually controls the number, not an
-- artifact of the provider's API shape.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_new_posts_sms boolean NOT NULL DEFAULT false;

-- Only verified numbers are constrained to one account -- a fan can freely overwrite an
-- unverified, still-pending `phone` value while trying different numbers, but once a
-- number is confirmed it can't also be claimed by a second account (which would make a
-- creator's opted-in-recipient count meaningless, and could deliver one fan's expected
-- notifications to somebody else's phone).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_verified
  ON users (phone) WHERE phone_verified_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The number being verified, not users.phone -- a fan can enter a wrong number and
  -- request a new code for a different one before ever confirming anything.
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The verify endpoint's lookup: "this user's most recent still-live code."
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user ON phone_verification_codes (user_id, created_at DESC);
