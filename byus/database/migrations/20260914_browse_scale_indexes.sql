-- Browse/search indexes for a growing creator directory.
-- Applied to the production Neon database on 2026-09-14.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_creator_created
  ON users (created_at DESC, id)
  WHERE role = 'creator' AND is_suspended = false;

CREATE INDEX IF NOT EXISTS idx_users_creator_name_trgm
  ON users USING gin (display_name gin_trgm_ops)
  WHERE role = 'creator' AND is_suspended = false;

CREATE INDEX IF NOT EXISTS idx_users_creator_bio_trgm
  ON users USING gin (bio gin_trgm_ops)
  WHERE role = 'creator' AND is_suspended = false;

CREATE INDEX IF NOT EXISTS idx_subscriptions_active_creator_created
  ON subscriptions (creator_id, created_at DESC)
  WHERE status = 'active';
