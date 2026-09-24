-- Requests a fan asked the ByUs help assistant to pass along to a human -- a refund,
-- a billing problem it couldn't answer from the account data, anything that needs a
-- person. See app/api/fan/assistant/route.js (creates them) and app/admin/support
-- (works them). The assistant itself is read-only: it can explain what a fan is
-- subscribed to and when they're billed, but the only thing it can *do* is file one
-- of these. A tracked row an admin resolves beats a "please email support" dead end.
CREATE TABLE IF NOT EXISTS support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('refund', 'billing', 'account', 'other')),
  summary text NOT NULL,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_requests_status_idx ON support_requests (status, created_at);
CREATE INDEX IF NOT EXISTS support_requests_user_idx ON support_requests (user_id, created_at DESC);

COMMENT ON TABLE support_requests IS
  'Fan help requests escalated to a human by the in-app assistant. The assistant never acts on them itself.';
