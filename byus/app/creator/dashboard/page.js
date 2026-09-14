// Server Component: loads the signed-in creator's profile, tiers, posts, and links on
// the server, before anything is sent to the browser, instead of shipping an empty
// shell that fetches all four client-side after hydration and gates the entire page
// behind a "Loading…" screen until they resolve. That client-fetch pattern is what was
// tanking this route's Real Experience Score — the biggest offender of the four flagged
// routes (29 fetch calls, 8 separate useEffect hooks across this file).
//
// All the interactive bits (creating tiers/posts, editing links, connecting Stripe,
// etc.) still live in DashboardClient — a Server Component can't hold onClick handlers
// or useState — this file's only job is getting the initial data there without a
// client waterfall. DashboardClient's own `load()` function still exists as a refresh
// path for after a mutation (e.g. creating a new tier), which is genuinely
// user-triggered and has nothing to do with first paint.

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { loadEnrichedUser } from '@/lib/user-profile';
import { loadCreatorTiers, loadCreatorPosts, loadCreatorLinks } from '@/lib/creator-dashboard-data';
import { query } from '@/lib/db';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function CreatorDashboardPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/login');
  }

  let user = null;
  try {
    user = await loadEnrichedUser(session);
  } catch (err) {
    console.error('creator/dashboard: user load failed:', err);
  }

  if (!user) {
    // A real failure (missing row, DB hiccup) — distinct from "not logged in" above.
    // Booting a logged-in creator to /login over this would be worse than just
    // showing a retry option, same distinction the old client-side load() made
    // between a 401 (redirect) and any other non-ok response (retry UI).
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <p className="text-brand-ink/70">Couldn't load your dashboard. Check your connection and try again.</p>
        <a
          href="/creator/dashboard"
          className="mt-4 inline-block rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#115E59]"
        >
          Try again
        </a>
      </div>
    );
  }

  // Tiers/posts/links are secondary to the user profile itself — a failure loading
  // any one of them shouldn't take down the whole dashboard, so each degrades to an
  // empty list instead of throwing, same as the old client-side load() silently kept
  // whatever array was already there on a non-ok response.
  const [tiers, posts, links, audienceStats, audienceMonthly] = await Promise.all([
    loadCreatorTiers(session.userId).catch((err) => {
      console.error('creator/dashboard: tiers load failed:', err);
      return [];
    }),
    loadCreatorPosts(session.userId).catch((err) => {
      console.error('creator/dashboard: posts load failed:', err);
      return [];
    }),
    loadCreatorLinks(session.userId).catch((err) => {
      console.error('creator/dashboard: links load failed:', err);
      return [];
    }),
    query(
      `SELECT
         COUNT(*)::int AS follower_count,
         COUNT(*) FILTER (WHERE f.created_at >= now() - interval '30 days')::int AS recent_follower_count,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM subscriptions s
             WHERE s.fan_id = f.fan_id
               AND s.creator_id = f.creator_id
               AND s.created_at >= f.created_at
               AND s.status = 'active'
               AND (s.current_period_end IS NULL OR s.current_period_end > now())
           )
         )::int AS converted_follower_count,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM subscriptions s
             WHERE s.fan_id = f.fan_id
               AND s.creator_id = f.creator_id
               AND s.created_at >= f.created_at
               AND s.created_at >= now() - interval '30 days'
               AND s.status = 'active'
               AND (s.current_period_end IS NULL OR s.current_period_end > now())
           )
         )::int AS recent_converted_follower_count
       FROM creator_follows f
       WHERE f.creator_id = $1`,
      [session.userId]
    )
      .then((result) => ({
        followerCount: result.rows[0].follower_count,
        recentFollowerCount: result.rows[0].recent_follower_count,
        convertedFollowerCount: result.rows[0].converted_follower_count,
        recentConvertedFollowerCount: result.rows[0].recent_converted_follower_count,
      }))
      .catch((err) => {
        console.error('creator/dashboard: audience stats load failed:', err);
        return { followerCount: 0, recentFollowerCount: 0, convertedFollowerCount: 0, recentConvertedFollowerCount: 0 };
      }),
    query(
      `WITH months AS (
         SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
         FROM generate_series(0, 5) AS n
       ),
       follows_by_month AS (
         SELECT date_trunc('month', created_at) AS month_start, COUNT(*) AS new_follows
         FROM creator_follows
         WHERE creator_id = $1
           AND created_at >= date_trunc('month', now()) - interval '5 months'
         GROUP BY 1
       ),
       first_active_conversion AS (
         SELECT f.fan_id, MIN(s.created_at) AS converted_at
         FROM creator_follows f
         JOIN subscriptions s
           ON s.creator_id = f.creator_id
          AND s.fan_id = f.fan_id
          AND s.created_at >= f.created_at
          AND s.status = 'active'
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
         WHERE f.creator_id = $1
         GROUP BY f.fan_id
       ),
       conversions_by_month AS (
         SELECT date_trunc('month', converted_at) AS month_start, COUNT(*) AS new_conversions
         FROM first_active_conversion
         WHERE converted_at >= date_trunc('month', now()) - interval '5 months'
         GROUP BY 1
       )
       SELECT
         to_char(m.month_start, 'YYYY-MM') AS month,
         COALESCE(f.new_follows, 0)::int AS new_follows,
         COALESCE(c.new_conversions, 0)::int AS new_conversions
       FROM months m
       LEFT JOIN follows_by_month f ON f.month_start = m.month_start
       LEFT JOIN conversions_by_month c ON c.month_start = m.month_start
       ORDER BY m.month_start ASC`,
      [session.userId]
    )
      .then((result) => result.rows.map((row) => ({
        month: row.month,
        newFollows: row.new_follows,
        newConversions: row.new_conversions,
      })))
      .catch((err) => {
        console.error('creator/dashboard: audience trend load failed:', err);
        return [];
      }),
  ]);

  return (
    <DashboardClient
      initialUser={user}
      initialTiers={tiers}
      initialPosts={posts}
      initialLinks={links}
      initialFollowerCount={audienceStats.followerCount}
      initialRecentFollowerCount={audienceStats.recentFollowerCount}
      initialConvertedFollowerCount={audienceStats.convertedFollowerCount}
      initialRecentConvertedFollowerCount={audienceStats.recentConvertedFollowerCount}
      initialAudienceMonthly={audienceMonthly}
    />
  );
}
