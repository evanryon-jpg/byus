-- RSS import for blogger creators (the "bloggers" acquisition + auto-import plan
-- item). A creator can point ByUs at their blog's RSS/Atom feed; syncing (manual for
-- now, see app/api/creator/rss/route.js) creates a new post for each feed entry not
-- already imported.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS rss_feed_url text,
  ADD COLUMN IF NOT EXISTS rss_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS rss_last_sync_error text;

-- Which feed entry a given post came from, so re-syncing the same feed never creates
-- duplicate posts. NULL for every ordinary, manually-written post.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS rss_guid text;

-- Partial unique index (not a plain UNIQUE column) because most posts have a NULL
-- rss_guid, and NULL <> NULL means a plain unique index would already allow that --
-- this just makes the "one post per feed entry, per creator" rule explicit and lets
-- the sync route's INSERT ... ON CONFLICT (creator_id, rss_guid) DO NOTHING work.
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_creator_rss_guid
  ON posts (creator_id, rss_guid) WHERE rss_guid IS NOT NULL;
