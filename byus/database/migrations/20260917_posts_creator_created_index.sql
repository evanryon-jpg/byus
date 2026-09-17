-- A creator's page (app/creator/[slug]/page.js) and the RSS-import dedupe checks (see
-- lib/rss.js / app/api/creator/rss/route.js) both list a single creator's posts ordered
-- newest-first. Without this, that's a full scan of the whole posts table filtered down
-- to one creator_id and sorted after the fact -- fine at today's volume, not fine once
-- posts is a table with real scale behind it. idx_posts_creator (creator_id alone,
-- already in place) narrows the scan but still can't satisfy the ORDER BY from the index
-- itself.
CREATE INDEX IF NOT EXISTS idx_posts_creator_created
  ON posts (creator_id, created_at DESC);
