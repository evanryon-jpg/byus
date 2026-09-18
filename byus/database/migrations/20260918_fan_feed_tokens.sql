-- Private, tokenized RSS/podcast feed per (fan, creator) pair. A fan pastes this
-- feed's URL into their own RSS/podcast app (Apple Podcasts, Overcast, Pocket Casts,
-- etc.) to get that creator's posts delivered automatically, without logging into
-- ByUs. The token itself IS the credential -- a podcast app has nowhere to put a
-- login cookie or a password, so the URL has to carry the whole proof of access on
-- its own. Same opaque-lookup-token pattern as telegram_link_tokens (see
-- 20260915_telegram_link_tokens.sql) rather than a signed JWT, but long-lived by
-- design instead of short/consumed-once: this is meant to sit in someone's podcast
-- app indefinitely, re-fetched on whatever schedule that app polls feeds on.
--
-- One row per (fan, creator) -- regenerating a leaked/shared link overwrites the
-- token in place (see lib/feed-token.js) rather than accumulating old rows, which
-- immediately invalidates whatever URL leaked without disturbing any other creator's
-- feed link for the same fan.
CREATE TABLE IF NOT EXISTS fan_feed_tokens (
  fan_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, creator_id)
);

-- The feed route looks up by token alone (it has no session/cookie to key off of),
-- so this is the lookup path that actually matters at request time.
CREATE INDEX IF NOT EXISTS idx_fan_feed_tokens_token ON fan_feed_tokens (token);
