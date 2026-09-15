-- Telegram's /start deep-link parameter is capped at 64 chars of [A-Za-z0-9_-], too
-- short for a self-contained signed JWT (this app's usual pattern for short-lived
-- tokens, see lib/auth.js) -- so the fan-connect handshake uses a short opaque random
-- token looked up here instead. Rows are tiny and short-lived by design; an unused or
-- already-consumed token is simply left behind rather than swept, same as this app
-- does for other small time-boxed rows elsewhere.
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user ON telegram_link_tokens (user_id);
