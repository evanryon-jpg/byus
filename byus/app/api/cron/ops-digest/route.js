export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Fires once a day (see vercel.json's crons entry) and emails the single ByUs operator
// a rollup of everything sitting in a queue -- reusing the exact same loaders /admin's
// own pages call (loadComplianceSnapshot, listPendingSmsBroadcastHolds) so this number
// never drifts from what clicking into /admin shows. This is the slower, complete
// counterpart to lib/alerts.js's alertReviewQueue: that one texts immediately for the
// two time-sensitive review cases, this one is the daily "did I miss anything" net for
// everything else (reports, disputes, SMS holds, suspension trend).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { loadComplianceSnapshot } from '@/lib/admin-data';
import { listPendingSmsBroadcastHolds } from '@/lib/sms-holds';
import { getAdminEmails } from '@/lib/admin';
import { sendOpsDigestEmail } from '@/lib/email';
import { countRiskEvents } from '@/lib/risk-score';
import { getFoundingPromoStats } from '@/lib/fees';
import { countFanPaymentsByRegion } from '@/lib/fan-payment-regions';

async function countAutoApprovedVideosLast24h() {
  // "approved" (vs. "approved_creator_pending") is only ever set by the moderation
  // webhook when the creator was already review_cleared_at at scan time -- see
  // handleModerationCompleted in app/api/webhooks/mux/route.js. Every row this counts
  // is a video that published itself with no human involved.
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM posts
     WHERE video_moderation_status = 'approved'
       AND video_moderated_at >= now() - interval '24 hours'`
  );
  return rows[0]?.n || 0;
}

// Good news rather than a queue: creators who joined the founding waitlist since the last
// digest, each with the founding spot the join reserved for them (spot is null if the
// program was already full). Listed by email because there are few enough that each one
// is worth seeing; capped so a sudden rush can't turn the digest into a wall of addresses.
async function listNewWaitlistSignups() {
  const { rows } = await query(
    `SELECT w.email, w.display_name, w.created_at, fr.spot_number
     FROM founding_waitlist w
     LEFT JOIN founding_reservations fr ON lower(fr.email) = lower(w.email)
     WHERE w.created_at >= now() - interval '24 hours'
     ORDER BY w.created_at ASC
     LIMIT 50`
  );
  return rows.map((row) => ({
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    foundingSpot: row.spot_number,
  }));
}

// Straight from the users table -- the reliable count, since Vercel's analytics never
// recorded the server-side funnel_account_created events.
async function countNewAccountsLast24h() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE role = 'fan')::int AS fans,
       COUNT(*) FILTER (WHERE role = 'creator')::int AS creators
     FROM users WHERE created_at >= now() - interval '24 hours'`
  );
  return { fans: rows[0]?.fans || 0, creators: rows[0]?.creators || 0 };
}

async function countOpenSupportRequests() {
  // Filed by the fan help assistant (app/api/fan/assistant) -- see app/admin/support.
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM support_requests WHERE status = 'open'`);
  return rows[0]?.n || 0;
}

export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('ops-digest: CRON_SECRET is not set — refusing to run.');
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const [snapshot, smsHolds, autoApprovedVideosLast24h, risk24h, openSupportRequests, newWaitlistSignups, foundingStats, newAccounts, fanRegions] = await Promise.all([
      loadComplianceSnapshot(),
      listPendingSmsBroadcastHolds(),
      countAutoApprovedVideosLast24h(),
      // Tolerate the table not existing yet (migration not applied) -- the rest of the
      // digest is still worth sending.
      countRiskEvents({ hours: 24 }).catch(() => ({ total: 0, high: 0, medium: 0 })),
      countOpenSupportRequests().catch(() => 0),
      listNewWaitlistSignups().catch(() => []),
      getFoundingPromoStats(query).catch(() => null),
      countNewAccountsLast24h().catch(() => ({ fans: 0, creators: 0 })),
      // Fan payments by country (VAT/GST triggers, see lib/fan-payment-regions.js). A Stripe
      // hiccup just leaves this section out.
      countFanPaymentsByRegion().catch((err) => {
        console.error('ops-digest: fan payment regions failed (continuing):', err);
        return null;
      }),
    ]);

    await sendOpsDigestEmail(getAdminEmails(), {
      pendingVideoReviews: snapshot.pendingVideoReviews,
      openContentReports: snapshot.openContentReports,
      openAppeals: snapshot.openAppeals,
      openPaymentDisputes: snapshot.openPaymentDisputes,
      pendingSmsHolds: smsHolds.length,
      openSupportRequests,
      highRiskCheckoutsLast24h: risk24h.high,
      suspensionsLast30d: snapshot.suspensionsLast30d,
      currentlySuspended: snapshot.currentlySuspended,
      autoApprovedVideosLast24h,
      checkoutsLast24h: risk24h.total,
      newWaitlistSignups,
      foundingStats,
      newFanAccountsLast24h: newAccounts.fans,
      newCreatorAccountsLast24h: newAccounts.creators,
      fanRegions,
      adminUrl: `${process.env.APP_URL}/admin`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('ops-digest cron failed:', error);
    return NextResponse.json({ error: 'Digest failed.' }, { status: 500 });
  }
}
