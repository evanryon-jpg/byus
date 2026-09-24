-- AI-assisted triage for suspension appeals (see lib/appeal-triage.js). Filled in
-- best-effort right after an appeal is submitted; all nullable because triage is
-- optional (model unconfigured or unavailable) and the appeal must still be filed.
-- The admin still makes every decision -- these columns only carry a recommendation,
-- the reasoning behind it, and a drafted resolution note the admin can edit or ignore.
ALTER TABLE suspension_appeals
  ADD COLUMN IF NOT EXISTS ai_recommendation text
    CHECK (ai_recommendation IN ('reinstate', 'uphold', 'needs_human')),
  ADD COLUMN IF NOT EXISTS ai_confidence text
    CHECK (ai_confidence IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS ai_reasoning text,
  ADD COLUMN IF NOT EXISTS ai_draft_resolution text,
  ADD COLUMN IF NOT EXISTS ai_triaged_at timestamptz;
