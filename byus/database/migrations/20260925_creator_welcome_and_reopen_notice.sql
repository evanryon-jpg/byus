-- Welcome + reopening-day emails (Sept 25, 2026).
--
-- users.creator_welcome_sent_at: set when the one-time "Welcome to ByUs" email goes out
-- (lib/creator-welcome.js claims it before sending). Existing creators are backfilled so
-- nobody who already has a page gets a welcome out of the blue.
ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_welcome_sent_at timestamptz;
UPDATE users SET creator_welcome_sent_at = COALESCE(created_at, now())
WHERE role = 'creator' AND creator_welcome_sent_at IS NULL;

-- founding_waitlist.reopen_notified_at: set when that person was emailed "signups are
-- open" from the admin page (app/api/admin/waitlist/notify-reopen), so each person is
-- emailed at most once however many times the button is pressed.
ALTER TABLE founding_waitlist ADD COLUMN IF NOT EXISTS reopen_notified_at timestamptz;
