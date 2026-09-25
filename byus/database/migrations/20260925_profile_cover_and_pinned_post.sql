-- Creator profile polish (Sept 25, 2026).
--
-- cover_image_url: private Vercel Blob pathname for the banner across the top of a
--   creator's public page, same storage model as profile_image_url (served publicly
--   through /api/cover/:userId). NULL = no banner.
-- pinned_post_id: one public post the creator pins to the top of their page as a
--   "Start here" intro (usually a welcome video). Cleared automatically if that post
--   is deleted.

ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;
