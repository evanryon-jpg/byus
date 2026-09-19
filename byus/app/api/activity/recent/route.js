export const dynamic = 'force-dynamic';

// GET /api/activity/recent
// Feeds the homepage's "Live Activity" toast ticker (app/components/LiveActivityTicker.jsx).
// Every row returned here is a REAL event that actually happened -- new creator signups,
// new follows, new subscriptions -- never fabricated or randomized. See the ticker
// component for the reasoning; short version: fake "someone just signed up!" notifications
// are a well-documented dark pattern, and this app has been consistent everywhere else
// (CreatorShowcase's "not real ByUs members" disclaimer, PlatformGoalGauge hiding itself
// rather than show a real "$0", FoundingCreatorProgram's stats coming straight off a live
// COUNT(*)) about never showing something as real that isn't. This endpoint just extends
// that same rule to this feature: if nothing real happened recently, it returns an empty
// list and the ticker simply doesn't appear -- it never invents activity to fill the gap.
//
// No fan-identifying information is ever included: a follow/subscription event names the
// creator (already public) but never the fan. No dollar amounts. A suspended creator's
// activity is excluded entirely, same as everywhere else this app surfaces a creator
// publicly.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { FOUNDING_CREATOR_LIMIT } from '@/lib/pricing';

const LOOKBACK = "interval '30 days'"; // old history isn't "activity" -- an ancient signup
// showing up as if it just happened would be its own small dishonesty, so events fall off
// the ticker entirely after a month rather than being relabeled with a stale timestamp.
const EVENT_LIMIT = 12;

function toActivityMessage(row) {
  const name = row.display_name || 'A creator';
  if (row.type === 'creator_joined') {
    return row.founding_rank != null
      ? { emoji: '🎉', message: `${name} just claimed founding spot #${row.founding_rank}` }
      : { emoji: '🎨', message: `${name} just joined ByUs as a creator` };
  }
  if (row.type === 'new_follow') {
    return { emoji: '💛', message: `Someone just followed ${name}` };
  }
  // 'new_subscription'
  return { emoji: '✨', message: `Someone just subscribed to ${name}` };
}

export async function GET() {
  try {
    const result = await query(
      `(
         SELECT
           'creator_joined' AS type,
           u.id AS subject_id,
           u.display_name,
           u.created_at AS occurred_at,
           founding.founding_rank
         FROM users u
         LEFT JOIN (
           -- Same tie-break order (created_at, id) as getFoundingCreatorRank (lib/fees.js)
           -- and the /api/creators list, so a rank named here always matches the badge on
           -- that creator's own profile page.
           SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS founding_rank
           FROM users
           WHERE role = 'creator' AND is_suspended = false
           ORDER BY created_at, id
           LIMIT ${FOUNDING_CREATOR_LIMIT}
         ) founding ON founding.id = u.id
         WHERE u.role = 'creator' AND u.is_suspended = false
           AND u.created_at >= now() - ${LOOKBACK}
       )
       UNION ALL
       (
         SELECT 'new_follow', cf.creator_id, u.display_name, cf.created_at, NULL::bigint
         FROM creator_follows cf
         JOIN users u ON u.id = cf.creator_id
         WHERE u.is_suspended = false AND cf.created_at >= now() - ${LOOKBACK}
       )
       UNION ALL
       (
         SELECT 'new_subscription', s.creator_id, u.display_name, s.created_at, NULL::bigint
         FROM subscriptions s
         JOIN users u ON u.id = s.creator_id
         WHERE u.is_suspended = false AND s.status = 'active'
           AND s.created_at >= now() - ${LOOKBACK}
       )
       ORDER BY occurred_at DESC
       LIMIT ${EVENT_LIMIT}`
    );

    const events = result.rows.map((row) => {
      const { emoji, message } = toActivityMessage(row);
      return {
        id: `${row.type}-${row.subject_id}-${new Date(row.occurred_at).getTime()}`,
        emoji,
        message,
        occurredAt: row.occurred_at,
      };
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error('activity/recent GET failed:', err);
    // A ticker that fails to load should just not appear -- never surface an error state
    // for a purely decorative feature.
    return NextResponse.json({ events: [] });
  }
}
