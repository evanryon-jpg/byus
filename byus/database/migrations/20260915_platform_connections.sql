-- Discord/Telegram role-and-group sync (ByUs Phase 2 item 3). Two pieces:
--
-- 1. Per-creator config, stored directly on users: which Discord server + role to
--    manage, and which Telegram group to invite/remove subscribers from. Nullable --
--    a creator who hasn't set these up simply has no bot behavior wired to them yet.
--
-- 2. Per-fan linkage in a new platform_connections table: which Discord/Telegram
--    account a given ByUs fan has connected. UNIQUE(user_id, provider) means a fan
--    can link at most one account per provider; UNIQUE(provider, provider_user_id)
--    means one Discord/Telegram account can't be linked to more than one ByUs
--    account (closes an obvious role-sharing hole -- otherwise a single Discord
--    account could be connected from N fake ByUs accounts to keep re-granting a role
--    after a subscription lapses on all-but-one of them).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS discord_guild_id text,
  ADD COLUMN IF NOT EXISTS discord_subscriber_role_id text,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

CREATE TABLE IF NOT EXISTS platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('discord', 'telegram')),
  provider_user_id text NOT NULL,
  provider_username text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_user ON platform_connections (user_id);
