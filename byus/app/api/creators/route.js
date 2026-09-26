export const dynamic = 'force-dynamic';

// GET /api/creators
// Public list of creators, for the "Browse creators" page. Accepts optional
// `q` (matched against display_name/bio) and `tag` (a single category tag)
// query params to search and filter the list.
//
// Also returns `availableTags` — every tag currently in use across all
// creators, computed independently of the current q/tag filter — so the
// browse page's filter chips stay a stable, complete palette no matter what
// the visitor has already searched for or selected.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { publicAvatarUrl } from '@/lib/avatar-url';
import { FOUNDING_CREATOR_LIMIT } from '@/lib/pricing';

// Sorting rules (fair and rule-based, Sept 26, 2026):
//   newest   -- most recently joined first.
//   popular  -- most active paying members first.
//   trending -- most new paying members in the last 30 days first, so a smaller creator
//               picking up momentum can outrank a bigger, quieter one.
//   shuffle  -- a different random order every day (same order all day, so paging is
//               stable). The homepage's "Creators on ByUs right now" uses this so every
//               creator gets the same chance to be seen there.
// Founding creators used to be pinned above every sort. That's gone: their perk is the
// 10% rate and the Founding badge, and pinning 50 names to the top buried every creator
// who joined after them.
//
// Optional filters on top of q/tag:
//   new=1          -- "New on ByUs": creators whose first public post went up in the
//                     last 30 days. Shown in a daily shuffle.
//   similarTo=<id> -- "Similar creators" for a creator page: creators sharing at least one
//                     category tag with that creator, most shared tags first, then the
//                     daily shuffle. Never includes the creator themselves.
// Both of those only list creators with at least one public post, so a fan who taps
// through always finds something to look at.
const DAILY_SHUFFLE = `md5(u.id::text || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'))`;
const SORTS = {
  newest: 'u.created_at DESC',
  popular: 'active_subscriber_count DESC, u.created_at DESC',
  trending: 'recent_subscriber_count DESC, active_subscriber_count DESC, u.created_at DESC',
  shuffle: DAILY_SHUFFLE,
};
const HAS_PUBLIC_POST = `EXISTS (SELECT 1 FROM posts pp WHERE pp.creator_id = u.id AND pp.visibility = 'public' AND pp.pending_review = false)`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const tag = (searchParams.get('tag') || '').trim();
  const sort = SORTS[searchParams.get('sort')] ? searchParams.get('sort') : 'newest';
  const newOnly = searchParams.get('new') === '1';
  const similarTo = (searchParams.get('similarTo') || '').trim();
  if (similarTo && !UUID_RE.test(similarTo)) {
    return NextResponse.json({ creators: [], availableTags: [], hasMore: false, nextOffset: null });
  }
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
  const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
  const pageSize = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 24) : 24;

  try {
    // A suspended creator simply doesn't exist as far as Browse/homepage/search are
    // concerned -- not a separate filter the visitor could ever toggle off, so it's
    // baked into the base condition list rather than something q/tag could interact
    // with. See app/api/admin/users/[id]/route.js for where is_suspended gets set.
    const conditions = [`u.role = 'creator'`, `u.is_suspended = false`];
    const values = [];
    let i = 1;

    if (q) {
      conditions.push(`(u.display_name ILIKE $${i} OR u.bio ILIKE $${i})`);
      values.push(`%${q}%`);
      i++;
    }
    if (tag) {
      conditions.push(`$${i} = ANY(u.tags)`);
      values.push(tag);
      i++;
    }
    if (newOnly) {
      conditions.push(HAS_PUBLIC_POST);
      conditions.push(
        `(SELECT MIN(np.created_at) FROM posts np WHERE np.creator_id = u.id AND np.visibility = 'public' AND np.pending_review = false) >= now() - interval '30 days'`
      );
    }
    let orderBy = newOnly ? DAILY_SHUFFLE : SORTS[sort];
    let sharedTagsSelect = '';
    if (similarTo) {
      conditions.push(`u.id <> $${i}`);
      conditions.push(`u.tags && (SELECT tags FROM users WHERE id = $${i})`);
      conditions.push(HAS_PUBLIC_POST);
      sharedTagsSelect = `, cardinality(ARRAY(SELECT unnest(u.tags) INTERSECT SELECT unnest((SELECT tags FROM users WHERE id = $${i})))) AS shared_tag_count`;
      orderBy = `shared_tag_count DESC, ${DAILY_SHUFFLE}`;
      values.push(similarTo);
      i++;
    }

    const [creatorsResult, tagsResult] = await Promise.all([
      query(
        `SELECT u.id, u.display_name, u.bio, u.profile_image_url, u.tags, u.slug,
                COALESCE(s.active_subscriber_count, 0)::int AS active_subscriber_count,
                COALESCE(r.recent_subscriber_count, 0)::int AS recent_subscriber_count,
                COALESCE(f.follower_count, 0)::int AS follower_count,
                (founding.id IS NOT NULL) AS is_founding,
                founding.founding_rank AS founding_creator_rank${sharedTagsSelect}
         FROM users u
         LEFT JOIN (
           SELECT creator_id AS id, spot_number AS founding_rank
           FROM founding_reservations WHERE creator_id IS NOT NULL
         ) founding ON founding.id = u.id
         LEFT JOIN (
           SELECT creator_id, COUNT(*) AS active_subscriber_count
           FROM subscriptions WHERE status = 'active' GROUP BY creator_id
         ) s ON s.creator_id = u.id
         LEFT JOIN (
           SELECT creator_id, COUNT(*) AS recent_subscriber_count
           FROM subscriptions
           WHERE status = 'active' AND created_at >= now() - interval '30 days'
           GROUP BY creator_id
         ) r ON r.creator_id = u.id
         LEFT JOIN (
           SELECT creator_id, COUNT(*) AS follower_count
           FROM creator_follows
           GROUP BY creator_id
         ) f ON f.creator_id = u.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${orderBy}
         LIMIT ${pageSize + 1} OFFSET $${i}`,
        [...values, offset]
      ),
      query(
        `SELECT DISTINCT unnest(tags) AS tag FROM users
         WHERE role = 'creator' AND cardinality(tags) > 0 ORDER BY tag`
      ),
    ]);

    // profile_image_url in the DB is a private Blob pathname — point the
    // client at our own public proxy route instead of exposing it directly.
    const hasMore = creatorsResult.rows.length > pageSize;
    const creators = creatorsResult.rows.slice(0, pageSize).map((c) => ({
      ...c,
      profile_image_url: publicAvatarUrl(c.id, c.profile_image_url),
      founding_creator_rank: c.founding_creator_rank != null ? Number(c.founding_creator_rank) : null,
      founding_creator_limit: FOUNDING_CREATOR_LIMIT,
    }));
    const availableTags = tagsResult.rows.map((r) => r.tag);

    return NextResponse.json({
      creators,
      availableTags,
      hasMore,
      nextOffset: hasMore ? offset + pageSize : null,
    });
  } catch (err) {
    console.error('creators GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load creators. Try again.' },
      { status: 500 }
    );
  }
}
