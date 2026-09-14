-- Free creator follows: audience-building without a paid subscription.
-- Applied to the production Neon database on 2026-09-14.

CREATE TABLE IF NOT EXISTS creator_follows (
  fan_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, creator_id),
  CHECK (fan_id <> creator_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_follows_creator_created
  ON creator_follows (creator_id, created_at DESC);
