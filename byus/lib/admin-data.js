// Shared platform-admin data loaders. Originally three separate blocks of query logic
// inline in app/api/admin/overview/route.js, app/api/admin/reports/route.js, and
// app/api/admin/suggestions/route.js — pulled out here so the /admin page's
// server-side initial load (app/admin/page.js) can produce the exact same shape those
// endpoints return without a second, silently-drifting copy of the SQL. Every caller
// is still responsible for its own getCurrentUser() + isAdmin() gate before calling
// these — none of them check authorization themselves.

import { query } from '@/lib/db';
import { getAdminEmails } from '@/lib/admin';
import { containsUrl } from '@/lib/content-policy';

const MONTHS_OF_HISTORY = 12;
const RECENT_CREATORS_LIMIT = 25;
const RECENT_DISPUTES_LIMIT = 25;
// Stripe's terminal dispute statuses -- everything else ('needs_response',
// 'under_review', 'warning_needs_response', etc.) still needs a human to look at it.
const CLOSED_DISPUTE_STATUSES = ['won', 'lost'];

// Platform-wide numbers for the owner: what ByUs itself has earned (not just what
// creators have earned), how many creators/fans have signed up, active subscriptions,
// a 12-month trailing series for the dashboard's charts, and a recent-creators list for
// spotting problem accounts (never onboarded Stripe, zero earnings after weeks, etc).
export async function loadAdminOverview() {
  const [counts, activeSubs, follows, followConversions, lifetime, monthlyResult, recentCreators, openDisputes, recentDisputes, needsReview] =
    await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE role = 'creator')::int AS creator_count,
           COUNT(*) FILTER (WHERE role = 'fan')::int AS fan_count
         FROM users`
      ),
      query(`SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'active'`),
      query(`SELECT COUNT(*)::int AS count FROM creator_follows`),
      query(
        `SELECT COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM subscriptions s
             WHERE s.fan_id = f.fan_id
               AND s.creator_id = f.creator_id
               AND s.created_at >= f.created_at
               AND s.status = 'active'
               AND (s.current_period_end IS NULL OR s.current_period_end > now())
           )
         )::int AS converted_count
         FROM creator_follows f`
      ),
      query(
        `SELECT
           COALESCE(SUM(amount_cents), 0)::bigint AS gross_cents,
           COALESCE(ROUND(SUM(amount_cents * fee_percent_applied) / 100.0), 0)::bigint AS platform_fee_cents,
           COUNT(*)::bigint AS payment_count
         FROM creator_earnings`
      ),
      query(
        `WITH months AS (
           SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
           FROM generate_series(0, $1::int - 1) AS n
         ),
         earnings_by_month AS (
           SELECT
             date_trunc('month', created_at) AS month_start,
             SUM(amount_cents) AS gross_cents,
             ROUND(SUM(amount_cents * fee_percent_applied) / 100.0) AS platform_fee_cents,
             COUNT(*) AS payment_count
           FROM creator_earnings
           WHERE created_at >= date_trunc('month', now()) - ($1::int - 1 || ' months')::interval
           GROUP BY 1
         ),
         signups_by_month AS (
           SELECT
             date_trunc('month', created_at) AS month_start,
             COUNT(*) FILTER (WHERE role = 'creator') AS new_creators,
             COUNT(*) FILTER (WHERE role = 'fan') AS new_fans
           FROM users
           WHERE created_at >= date_trunc('month', now()) - ($1::int - 1 || ' months')::interval
           GROUP BY 1
         ),
         follows_by_month AS (
           SELECT date_trunc('month', created_at) AS month_start, COUNT(*) AS new_follows
           FROM creator_follows
           WHERE created_at >= date_trunc('month', now()) - ($1::int - 1 || ' months')::interval
           GROUP BY 1
         )
         SELECT
           to_char(m.month_start, 'YYYY-MM') AS month,
           COALESCE(e.gross_cents, 0)::bigint AS gross_cents,
           COALESCE(e.platform_fee_cents, 0)::bigint AS platform_fee_cents,
           COALESCE(e.payment_count, 0)::bigint AS payment_count,
           COALESCE(s.new_creators, 0)::bigint AS new_creators,
           COALESCE(s.new_fans, 0)::bigint AS new_fans,
           COALESCE(f.new_follows, 0)::bigint AS new_follows
         FROM months m
         LEFT JOIN earnings_by_month e ON e.month_start = m.month_start
         LEFT JOIN signups_by_month s ON s.month_start = m.month_start
         LEFT JOIN follows_by_month f ON f.month_start = m.month_start
         ORDER BY m.month_start ASC`,
        [MONTHS_OF_HISTORY]
      ),
      query(
        `SELECT
           u.id, u.display_name, u.email, u.bio, u.created_at, u.stripe_connect_onboarded,
           u.platform_fee_percent, u.is_suspended, u.suspension_reason, u.review_cleared_at,
           COALESCE(e.gross_cents, 0)::bigint AS lifetime_gross_cents,
           COALESCE(e.platform_fee_cents, 0)::bigint AS lifetime_platform_fee_cents,
           COALESCE(e.payment_count, 0)::bigint AS lifetime_payment_count,
           COALESCE(f.follower_count, 0)::int AS follower_count,
           COALESCE(f.converted_follower_count, 0)::int AS converted_follower_count
         FROM users u
         LEFT JOIN (
           SELECT creator_id, SUM(amount_cents) AS gross_cents,
                  ROUND(SUM(amount_cents * fee_percent_applied) / 100.0) AS platform_fee_cents,
                  COUNT(*) AS payment_count
           FROM creator_earnings GROUP BY creator_id
         ) e ON e.creator_id = u.id
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*)::int AS follower_count,
             COUNT(*) FILTER (
               WHERE EXISTS (
                 SELECT 1 FROM subscriptions s
                 WHERE s.fan_id = cf.fan_id
                   AND s.creator_id = cf.creator_id
                   AND s.created_at >= cf.created_at
                   AND s.status = 'active'
                   AND (s.current_period_end IS NULL OR s.current_period_end > now())
               )
             )::int AS converted_follower_count
           FROM creator_follows cf
           WHERE cf.creator_id = u.id
         ) f ON true
         WHERE u.role = 'creator'
         ORDER BY u.created_at DESC
         LIMIT $1`,
        [RECENT_CREATORS_LIMIT]
      ),
      query(
        `SELECT COUNT(*)::int AS count FROM stripe_disputes WHERE status != ALL($1::text[])`,
        [CLOSED_DISPUTE_STATUSES]
      ),
      query(
        `SELECT
           d.id, d.stripe_dispute_id, d.amount_cents, d.currency, d.reason, d.status,
           d.opened_at, d.closed_at, d.response_due_at, d.alert_sent_at,
           creator.display_name AS creator_name, creator.email AS creator_email,
           fan.display_name AS fan_name, fan.email AS fan_email
         FROM stripe_disputes d
         LEFT JOIN users creator ON creator.id = d.creator_id
         LEFT JOIN users fan ON fan.id = d.fan_id
         ORDER BY
           CASE
             WHEN d.status NOT IN ('won', 'lost') AND d.response_due_at IS NOT NULL THEN 0
             WHEN d.status NOT IN ('won', 'lost') THEN 1
             ELSE 2
           END,
           d.response_due_at ASC NULLS LAST,
           d.opened_at DESC
         LIMIT $1`,
        [RECENT_DISPUTES_LIMIT]
      ),
      query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'creator' AND review_cleared_at IS NULL`),
    ]);

  const monthly = monthlyResult.rows.map((row) => ({
    month: row.month,
    grossCents: Number(row.gross_cents),
    platformFeeCents: Number(row.platform_fee_cents),
    paymentCount: Number(row.payment_count),
    estimatedProcessorCents: Math.round(Number(row.gross_cents) * 0.036 + Number(row.payment_count) * 30),
    estimatedContributionCents:
      Number(row.platform_fee_cents) -
      Math.round(Number(row.gross_cents) * 0.036 + Number(row.payment_count) * 30),
    newCreators: Number(row.new_creators),
    newFans: Number(row.new_fans),
    newFollows: Number(row.new_follows),
  }));

  const adminEmails = getAdminEmails();
  const creators = recentCreators.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    stripeConnectOnboarded: row.stripe_connect_onboarded,
    platformFeePercent: row.platform_fee_percent,
    lifetimeGrossCents: Number(row.lifetime_gross_cents),
    lifetimePlatformFeeCents: Number(row.lifetime_platform_fee_cents),
    lifetimePaymentCount: Number(row.lifetime_payment_count),
    followerCount: Number(row.follower_count),
    convertedFollowerCount: Number(row.converted_follower_count),
    followerConversionPercent:
      Number(row.follower_count) > 0
        ? Math.round((Number(row.converted_follower_count) / Number(row.follower_count)) * 1000) / 10
        : 0,
    estimatedProcessorCents:
      Math.round(Number(row.lifetime_gross_cents) * 0.036 + Number(row.lifetime_payment_count) * 30),
    estimatedContributionCents:
      Number(row.lifetime_platform_fee_cents) -
      Math.round(Number(row.lifetime_gross_cents) * 0.036 + Number(row.lifetime_payment_count) * 30),
    isSuspended: row.is_suspended,
    suspensionReason: row.suspension_reason,
    // needsReview: this creator hasn't cleared ByUs's one-time initial review yet --
    // their posts stay unpublished and fans can't subscribe/tip until an admin clears
    // them (POST /api/admin/users/:id/clear-review). bioFlagged: their bio contains
    // something that looks like a URL -- not blocked outright (see lib/content-policy.js),
    // just worth a human actually reading it. isProtectedAdmin: this row's email is on
    // lib/admin.js's own allowlist, the same list app/api/admin/users/[id]/route.js checks
    // before honoring a suspend request for real -- flagged per-row here (not just for
    // whichever admin happens to be viewing) so the dashboard shows "Protected" for every
    // admin/owner account, not only the one currently logged in.
    needsReview: !row.review_cleared_at,
    bioFlagged: containsUrl(row.bio),
    isProtectedAdmin: Boolean(row.email && adminEmails.includes(row.email.toLowerCase())),
  }));

  const nowMs = Date.now();
  const disputes = recentDisputes.rows.map((row) => {
    const responseDueAt = row.response_due_at || null;
    const millisecondsRemaining = responseDueAt ? new Date(responseDueAt).getTime() - nowMs : null;
    const hoursRemaining =
      millisecondsRemaining === null ? null : Math.ceil(millisecondsRemaining / (60 * 60 * 1000));
    const isClosed = CLOSED_DISPUTE_STATUSES.includes(row.status);

    return {
      id: row.id,
      stripeDisputeId: row.stripe_dispute_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      responseDueAt,
      hoursRemaining,
      responseOverdue: !isClosed && hoursRemaining !== null && hoursRemaining < 0,
      responseUrgent: !isClosed && hoursRemaining !== null && hoursRemaining >= 0 && hoursRemaining <= 72,
      alertSentAt: row.alert_sent_at,
      creatorName: row.creator_name,
      creatorEmail: row.creator_email,
      fanName: row.fan_name,
      fanEmail: row.fan_email,
    };
  });

  const lifetimeGrossCents = Number(lifetime.rows[0].gross_cents);
  const lifetimePlatformFeeCents = Number(lifetime.rows[0].platform_fee_cents);
  const lifetimePaymentCount = Number(lifetime.rows[0].payment_count);
  const estimatedProcessorCents = Math.round(lifetimeGrossCents * 0.036 + lifetimePaymentCount * 30);
  const followerCount = follows.rows[0].count;
  const convertedFollowerCount = followConversions.rows[0].converted_count;
  const followerConversionPercent =
    followerCount > 0 ? Math.round((convertedFollowerCount / followerCount) * 1000) / 10 : 0;

  return {
    creatorCount: counts.rows[0].creator_count,
    fanCount: counts.rows[0].fan_count,
    activeSubscriberCount: activeSubs.rows[0].count,
    followerCount,
    convertedFollowerCount,
    followerConversionPercent,
    lifetimeGrossCents,
    lifetimePlatformFeeCents,
    lifetimePaymentCount,
    estimatedProcessorCents,
    estimatedContributionCents: lifetimePlatformFeeCents - estimatedProcessorCents,
    openDisputeCount: openDisputes.rows[0].count,
    needsReviewCount: needsReview.rows[0].count,
    monthly,
    creators,
    disputes,
  };
}

const REPORT_STATUS_ORDER = `CASE r.status
  WHEN 'new' THEN 0
  WHEN 'reviewed' THEN 1
  WHEN 'resolved' THEN 2
  WHEN 'dismissed' THEN 3
  ELSE 4 END`;

// Every content report ever submitted, newest-first within an open-first ordering.
export async function loadAdminReports() {
  const result = await query(
    `SELECT r.id, r.reason, r.details, r.status, r.admin_note, r.created_at, r.updated_at,
            r.post_id, p.title AS post_title,
            reporter.id AS reporter_id, reporter.display_name AS reporter_name, reporter.email AS reporter_email,
            creator.id AS creator_id, creator.display_name AS creator_name, creator.email AS creator_email,
            creator.slug AS creator_slug, creator.is_suspended AS creator_is_suspended,
            creator.suspension_reason AS creator_suspension_reason
     FROM reports r
     JOIN users reporter ON reporter.id = r.reporter_id
     JOIN users creator ON creator.id = r.creator_id
     LEFT JOIN posts p ON p.id = r.post_id
     ORDER BY ${REPORT_STATUS_ORDER}, r.created_at DESC`
  );
  return result.rows;
}

const SUGGESTION_STATUS_ORDER = `CASE status
  WHEN 'new' THEN 0
  WHEN 'reviewed' THEN 1
  WHEN 'planned' THEN 2
  WHEN 'shipped' THEN 3
  ELSE 4 END`;

// Every suggestion ever submitted (creator or fan), newest-first within an
// open-first ordering.
export async function loadAdminSuggestions() {
  const result = await query(
    `SELECT s.id, s.message, s.status, s.admin_note, s.created_at, s.updated_at,
            u.id AS user_id, u.display_name, u.email, u.role
     FROM suggestions s
     JOIN users u ON u.id = s.user_id
     ORDER BY ${SUGGESTION_STATUS_ORDER}, s.created_at DESC`
  );
  return result.rows;
}
