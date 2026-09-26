-- "I'm on it" claims on support desk items (Sept 26, 2026). See app/api/staff/claims.
--
-- One row per item someone on the team has picked up, so two helpers never work the same
-- video, report or fan request. item_type: 'video' (posts.id awaiting review), 'report'
-- (reports.id), 'support' (support_requests.id). A claim older than 12 hours counts as
-- unclaimed, so an item never gets stuck behind someone who stepped away. Rows for
-- finished items are harmless and just age out of view.

CREATE TABLE IF NOT EXISTS staff_claims (
  item_type  text NOT NULL CHECK (item_type IN ('video', 'report', 'support')),
  item_id    uuid NOT NULL,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_type, item_id)
);
