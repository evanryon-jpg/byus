-- Phase 1 of the native feature parity plan: likes and view counts on posts.
--
-- post_likes mirrors the existing poll_votes shape (one row per fan per post,
-- unique on the pair) but is a plain toggle rather than a value -- a fan either
-- has a row here or doesn't, so the API route inserts/deletes rather than
-- upserting a column value the way poll_votes does for option_index.
--
-- view_count lives directly on posts rather than in its own table: a view has
-- no per-fan identity worth keeping (no "who viewed this" feature is planned),
-- so a running integer is all Phase 1 needs. Shown to the creator on their own
-- dashboard first, per the plan's explicit scoping.
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  fan_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, fan_id)
);

-- Read pattern is always "all likes for this post" (a count) or "does this
-- fan like this post" (the UNIQUE index above already covers the second) --
-- this index covers the first without a full scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes (post_id);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
