-- Fixes a real broken-link bug: changing a vanity URL (app/api/creator/slug/route.js)
-- previously just overwrote users.slug with no record of the old value, so any link a
-- creator had already shared under their old slug started returning "Creator not
-- found" the moment they changed it. This table tracks the slug a creator moved away
-- from, so app/creator/[creatorId]/page.js's existing canonical-slug redirect (already
-- built for old UUID links) can also carry an old slug forward to wherever that
-- creator lives now instead of dead-ending.
--
-- Primary key on old_slug (not a plain index) because only the most recent departure
-- from a given slug needs to be remembered — the PATCH route upserts on conflict. If a
-- slug is later reassigned and claimed live by a different creator, the direct
-- users.slug lookup in lib/creator-profile-data.js always runs first and always wins;
-- this table is only ever consulted as a fallback when no one currently holds the slug
-- live, so a currently-claimed slug can never be shadowed by a stale redirect.
CREATE TABLE IF NOT EXISTS creator_slug_history (
  old_slug text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  replaced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_slug_history_user_id ON creator_slug_history (user_id);
