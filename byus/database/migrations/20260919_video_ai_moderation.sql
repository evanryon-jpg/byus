-- Store the asynchronous Mux Robots decision separately from pending_review.
-- pending_review remains the single visibility gate; these fields explain why a
-- video is held and make webhook processing idempotent.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS video_moderation_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS video_moderation_job_id text,
  ADD COLUMN IF NOT EXISTS video_moderation_scores jsonb,
  ADD COLUMN IF NOT EXISTS video_moderated_at timestamptz;

UPDATE posts
SET video_moderation_status = CASE
  WHEN pending_review THEN 'manual_review'
  ELSE 'manual_approved'
END
WHERE mux_playback_id IS NOT NULL
  AND video_moderation_status = 'not_required';

CREATE INDEX IF NOT EXISTS posts_video_moderation_status_idx
  ON posts (video_moderation_status, created_at)
  WHERE mux_playback_id IS NOT NULL;
