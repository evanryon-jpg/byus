-- Private admin-only Instagram outreach tracker.
CREATE TABLE IF NOT EXISTS outreach_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_handle text NOT NULL,
  follower_count bigint CHECK (follower_count IS NULL OR follower_count >= 0),
  latest_content_note text,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'messaged', 'replied', 'interested', 'not_interested')),
  messaged_at timestamptz,
  follow_up_due_at timestamptz,
  followed_up_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_contacts_handle_lower
  ON outreach_contacts (lower(instagram_handle));

CREATE INDEX IF NOT EXISTS idx_outreach_contacts_follow_up_due
  ON outreach_contacts (follow_up_due_at)
  WHERE status = 'messaged' AND followed_up_at IS NULL;
