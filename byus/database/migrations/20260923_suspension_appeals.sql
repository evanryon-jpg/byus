-- Structured appeals of a ByUs suspension decision, replacing "just email support" with
-- a tracked record tied to the specific suspension it's about. One row per appeal attempt;
-- a user can only have one OPEN appeal against their current suspension at a time (enforced
-- in application code, not a constraint here, since "current suspension" depends on the
-- live is_suspended/suspended_at state on users, not something a CHECK can see).
CREATE TABLE IF NOT EXISTS suspension_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suspended_at timestamptz NOT NULL,
  suspension_reason text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution text,
  reinstated boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suspension_appeals_status_idx ON suspension_appeals (status, created_at);
CREATE INDEX IF NOT EXISTS suspension_appeals_user_idx ON suspension_appeals (user_id, created_at DESC);

COMMENT ON TABLE suspension_appeals IS
  'Tracked appeals of a suspension decision, submitted from the public /appeal page.';
