// How much video a creator has stored vs. their allowance (lib/video-limits.js). Stored
// time is the sum of posts.video_duration_seconds for their video posts; videos posted
// before that column existed get their length looked up from Mux once and saved.
// Paying members = active subscriptions, plus members who switched over and have
// their first charge scheduled (trialing). Server-only.

import { query } from '@/lib/db';
import { getAsset } from '@/lib/mux';
import { videoStorageLimitSeconds } from '@/lib/video-limits';

export async function getVideoStorage(creatorId) {
  const missing = await query(
    `SELECT id, mux_asset_id FROM posts
     WHERE creator_id = $1 AND mux_asset_id IS NOT NULL AND video_duration_seconds IS NULL
     LIMIT 50`,
    [creatorId]
  );
  for (const row of missing.rows) {
    try {
      const asset = await getAsset(row.mux_asset_id);
      const seconds = Number(asset?.duration);
      if (Number.isFinite(seconds)) {
        await query(`UPDATE posts SET video_duration_seconds = $1 WHERE id = $2`, [seconds, row.id]);
      }
    } catch (err) {
      console.error(`video-storage: could not read duration for post ${row.id}:`, err.message);
    }
  }

  const [used, members] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(video_duration_seconds), 0)::float AS s FROM posts
       WHERE creator_id = $1 AND mux_asset_id IS NOT NULL`,
      [creatorId]
    ),
    query(
      `SELECT COUNT(*)::int AS n FROM subscriptions WHERE creator_id = $1 AND status IN ('active', 'trialing')`,
      [creatorId]
    ),
  ]);
  const payingMembers = members.rows[0]?.n || 0;
  const usedSeconds = Math.round(used.rows[0]?.s || 0);
  const limitSeconds = videoStorageLimitSeconds(payingMembers);
  return { usedSeconds, limitSeconds, payingMembers, full: usedSeconds >= limitSeconds };
}
