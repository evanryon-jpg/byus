-- Supports follower-to-paid conversion lookups without scanning every active
-- subscription for a creator. The fan id narrows each EXISTS check to the exact
-- follower relationship; created_at verifies that payment began after the follow.
-- current_period_end is included so PostgreSQL can often answer from the index alone.
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_creator_fan_created
  ON subscriptions (creator_id, fan_id, created_at DESC)
  INCLUDE (current_period_end)
  WHERE status = 'active';
