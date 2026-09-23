-- Durable proof of the exact legal documents a person affirmatively accepted.
-- One row represents one acceptance event; rows are intentionally append-only.
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_at_acceptance text NOT NULL CHECK (role_at_acceptance IN ('creator', 'fan')),
  source text NOT NULL CHECK (source IN ('email_signup', 'google_signup', 'apple_signup', 'creator_onboarding', 'policy_reacceptance')),
  documents jsonb NOT NULL,
  ip_address text,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_date_idx
  ON legal_acceptances (user_id, accepted_at DESC);

COMMENT ON TABLE legal_acceptances IS
  'Append-only evidence of affirmative assent to versioned ByUs legal documents.';
