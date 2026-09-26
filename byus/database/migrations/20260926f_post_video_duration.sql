-- Video length on each video post (Sept 26, 2026), for the per-creator video storage
-- allowance in lib/video-limits.js (10 hours + 1 per paying member, up to 200). Filled in
-- when a video post is created; older video posts are filled in the first time the
-- creator's storage is checked (lib/video-storage.js).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_duration_seconds numeric;
