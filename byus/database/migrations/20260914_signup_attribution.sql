-- First-touch signup attribution for ByUs-owned campaign links.
-- Values are normalized by the application; NULL means no known campaign source.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS acquisition_source text;

CREATE INDEX IF NOT EXISTS idx_users_acquisition_source_created
  ON users (acquisition_source, created_at DESC)
  WHERE acquisition_source IS NOT NULL;
