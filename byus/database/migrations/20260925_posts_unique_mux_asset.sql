-- One uploaded video (Mux asset) can back only one post. Without this, a double-submit
-- of the post form created two posts sharing an asset, and deleting either post (or
-- rejecting it in moderation) deleted the shared Mux asset out from under the other.
-- app/api/creator/posts/route.js turns a violation into a 409 "already posted".
CREATE UNIQUE INDEX IF NOT EXISTS posts_mux_asset_id_key
  ON posts (mux_asset_id) WHERE mux_asset_id IS NOT NULL;
