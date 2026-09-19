-- Internal punch-list for the ByUs team, replacing the ad-hoc tracking that had been
-- happening by hand across chat/notes. Deliberately minimal (title/status/category/notes)
-- rather than a full project-management schema -- there's one admin today, so no
-- assignee, due date, or priority field until a second person actually needs one.
-- Lives entirely behind /admin's existing isAdmin() gate; no public-facing surface.
CREATE TABLE IF NOT EXISTS admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  category text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The admin view always orders by status bucket first (doing, then todo, then done)
-- and newest-first within each bucket -- this index matches that access pattern.
CREATE INDEX IF NOT EXISTS idx_admin_tasks_status_created ON admin_tasks (status, created_at DESC);
