-- Phase 2 of the native feature parity plan: the public discovery feed
-- (GET /api/discover, app/discover/page.js).
--
-- The feed's query is always "every post where visibility = 'public' AND
-- pending_review = false, newest first" -- across every creator, not scoped
-- to one creator_id the way idx_posts_creator_created is. Without this, that
-- scan only gets cheaper as more of the table happens to match the filter,
-- never cheaper from an index. Partial on the exact pair of conditions the
-- feed query applies together, so non-public and still-pending-review posts
-- (the vast majority once creators have private/gated posts too) never
-- bloat it.
CREATE INDEX IF NOT EXISTS idx_posts_public_feed
  ON posts (created_at DESC)
  WHERE visibility = 'public' AND pending_review = false;
