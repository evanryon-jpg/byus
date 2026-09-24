-- One row per checkout attempt (subscription, tip, or digital product) with the risk
-- score ByUs computed for it *before* handing the fan off to Stripe Checkout -- see
-- lib/risk-score.js. This is application-level scoring on signals Stripe can't see
-- (account age, signup IP vs. checkout IP, signup-to-purchase speed, disposable email
-- domains, prior disputes on this account, attempt velocity); custom Radar rules on
-- those same signals would require Stripe's paid Radar tier, and this costs nothing.
--
-- Deliberately logs EVERY attempt, not just risky ones: the velocity signal counts a
-- fan's recent attempts from this very table, and a full history is what makes a
-- future "was this fan already looking risky before the dispute?" question answerable.
-- Nothing here blocks a checkout -- see the header of lib/risk-score.js for why.
CREATE TABLE IF NOT EXISTS checkout_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('subscription', 'tip', 'product')),
  amount_cents integer NOT NULL,
  ip_address text,
  score integer NOT NULL,
  level text NOT NULL CHECK (level IN ('low', 'medium', 'high')),
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Velocity lookups ("how many attempts has this fan made in the last hour") and the
-- admin page's "recent high-risk attempts" list both want these.
CREATE INDEX IF NOT EXISTS checkout_risk_events_user_date_idx
  ON checkout_risk_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_risk_events_level_date_idx
  ON checkout_risk_events (level, created_at DESC);

COMMENT ON TABLE checkout_risk_events IS
  'Application-level fraud risk score for every checkout attempt, computed before Stripe Checkout. Advisory only; never blocks.';
