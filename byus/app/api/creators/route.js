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
import { getAdminEmails } from '@/lib/admin';

// 'popular' and 'trending' both need a subscriber count to sort by, so they're a
// distinct query shape rather than just an ORDER BY swap on the same SELECT. 'trending'
// ranks by subscribers gained in the last 30 days rather than all-time total, so a newer
// creator who's picking up momentum right now can outrank a bigger, quieter account --
// the same "gaining traction" signal a homepage or explore feed uses elsewhere.
//
// Every sort leads with `is_founding DESC` -- the first FOUNDING_CREATOR_LIMIT creators
// (see lib/fees.js) always float to the top of Browse and the homepage's Featured
// Creators section (app/components/FeaturedCreators.jsx pulls from this same endpoint),
// ahead of whatever the visitor actually asked to sort by. That's the "featured
// placement" half of the founding-creator perk; the fee side already lives in lib/fees.js.
const SORTS = {
  newest: 'is_founding DESC, u.created_at DESC',
  popular: 'is_founding DESC, active_subscriber_count DESC, u.created_at DESC',
  trending: 'is_founding DESC, recent_subscriber_count DESC, active_subscriber_count DESC, u.created_at DESC',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const tag = (searchParams.get('tag') || '').trim();
  const sort = SORTS[searchParams.get('sort')] ? searchParams.get('sort') : 'newest';
  const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
  const pageSize = 24;

  try {
    // A suspended creator simply doesn't exist as far as Browse/homepage/search are
    // concerned -- not a separate filter the visitor could ever toggle off, so it's
    // baked into the base condition list rather than something q/tag could interact
    // with. See app/api/admin/users/[id]/route.js for where is_suspended gets set.
    const adminEmails = getAdminEmails();
    const conditions = [
      `u.role = 'creator'`,
      `u.is_suspended = false`,
      `NOT (LOWER(u.email) = ANY($1::text[]))`,
    ];
    const values = [adminEmails];
    let i = 2;

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

    const [creatorsResult, tagsResult] = await Promise.all([
      query(
        `SELECT u.id, u.display_name, u.bio, u.profile_image_url, u.tags, u.slug,
                COALESCE(s.active_subscriber_count, 0)::int AS active_subscriber_count,
                COALESCE(r.recent_subscriber_count, 0)::int AS recent_subscriber_count,
                COALESCE(f.follower_count, 0)::int AS follower_count,
                (founding.id IS NOT NULL) AS is_founding,
                founding.founding_rank AS founding_creator_rank
         FROM users u
         LEFT JOIN (
           -- Same tie-break order (created_at, id) as getFoundingCreatorRank (lib/fees.js),
           -- so the number badged here always matches the one on a creator's own profile
           -- page -- computed inside this already-existing is_founding subquery rather
           -- than a second round trip per creator.
           SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS founding_rank
           FROM users
           WHERE role = 'creator'
             AND is_suspended = false
             AND NOT (LOWER(email) = ANY($1::text[]))
           ORDER BY created_at, id
           LIMIT ${FOUNDING_CREATOR_LIMIT}
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
         ORDER BY ${SORTS[sort]}
         LIMIT 25 OFFSET $${i}`,
        [...values, offset]
      ),
      query(
        `SELECT DISTINCT unnest(tags) AS tag FROM users
         WHERE role = 'creator'
           AND is_suspended = false
           AND NOT (LOWER(email) = ANY($1::text[]))
           AND cardinality(tags) > 0
         ORDER BY tag`,
        [adminEmails]
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
