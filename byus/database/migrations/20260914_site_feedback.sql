-- Anonymous visitor feedback widget (thumbs up/down + optional short note), shown
-- near the top of the public homepage. No account required to submit, so there is no
-- user_id here on purpose -- unlike `suggestions`, which is scoped to a logged-in
-- creator or fan. reaction is nullable because the widget allows leaving just a note.
CREATE TABLE IF NOT EXISTS site_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reaction text CHECK (reaction IN ('up', 'down')),
  message text,
  page_path text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reaction IS NOT NULL OR message IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_site_feedback_created_at ON site_feedback (created_at DESC);
