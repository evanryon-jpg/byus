export const dynamic = 'force-dynamic';

// GET /api/creator/earnings
// The creator's real earnings view: lifetime gross/net revenue, where this MONTH's
// earnings put them on the platform fee tier, current active subscriber count, and a
// 12-month trailing series (gross, net, and new subscribers per month) for the dashboard's
// charts. Purely informational — the actual fee (and the moment it moves, in either
// direction) is decided in lib/fees.js, triggered off real Stripe payments in the webhook,
// never here.
//
// Net-per-month uses fee_percent_applied, the rate that actually applied to each invoice
// at the time it was paid (see lib/fees.js) — not the creator's current rate — so a past
// month's net figure never shifts just because the creator's fee later dropped.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { STANDARD_FEE_PERCENT, DISCOUNTED_FEE_PERCENT, FEE_DISCOUNT_THRESHOLD_CENTS } from '@/lib/stripe';
import { getPlatformMilestoneReductionPoints, applyPlatformMilestoneReduction } from '@/lib/fees';

const MONTHS_OF_HISTORY = 12;

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Creators only.' }, { status: 403 });
  }

  try {
    const [feeResult, reductionPoints, lifetimeResult, subscriberResult, churnResult, monthlyResult] = await Promise.all([
      query('SELECT platform_fee_percent FROM users WHERE id = $1', [session.userId]),
      getPlatformMilestoneReductionPoints(query),
      query(
        `SELECT
           COALESCE(SUM(amount_cents), 0)::bigint AS gross_cents,
           COALESCE(ROUND(SUM(amount_cents * (100 - fee_percent_applied)) / 100.0), 0)::bigint AS net_cents
         FROM creator_earnings
         WHERE creator_id = $1`,
        [session.userId]
      ),
      query(`SELECT COUNT(*)::int AS count FROM subscriptions WHERE creator_id = $1 AND status = 'active'`, [
        session.userId,
      ]),
      // Lifetime churn: of everyone who ever subscribed, how many have since canceled.
      // A simple, honest lifetime ratio rather than a month-by-month rate, which would
      // need a daily snapshot of "who was active" that this schema doesn't keep.
      query(
        `SELECT
           COUNT(*)::int AS ever_subscribed,
           COUNT(*) FILTER (WHERE status = 'canceled')::int AS ever_canceled
         FROM subscriptions WHERE creator_id = $1`,
        [session.userId]
      ),
      // Zero-filled trailing 12 months (oldest first), even for a creator with no rows yet
      // — the chart always gets a full, evenly-spaced x-axis to render against.
      query(
        `WITH months AS (
           SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
           FROM generate_series(0, $2::int - 1) AS n
         ),
         earnings_by_month AS (
           SELECT
             date_trunc('month', created_at) AS month_start,
             SUM(amount_cents) AS gross_cents,
             ROUND(SUM(amount_cents * (100 - fee_percent_applied)) / 100.0) AS net_cents
           FROM creator_earnings
           WHERE creator_id = $1
             AND created_at >= date_trunc('month', now()) - ($2::int - 1 || ' months')::interval
           GROUP BY 1
         ),
         subs_by_month AS (
           SELECT date_trunc('month', created_at) AS month_start, COUNT(*) AS new_subscribers
           FROM subscriptions
           WHERE creator_id = $1
             AND created_at >= date_trunc('month', now()) - ($2::int - 1 || ' months')::interval
           GROUP BY 1
         ),
         cancellations_by_month AS (
           -- updated_at is the best signal this schema has for "when did this subscription
           -- actually cancel" -- it's the timestamp of the subscription's last status change.
           SELECT date_trunc('month', updated_at) AS month_start, COUNT(*) AS canceled_subscribers
           FROM subscriptions
           WHERE creator_id = $1 AND status = 'canceled'
             AND updated_at >= date_trunc('month', now()) - ($2::int - 1 || ' months')::interval
           GROUP BY 1
         )
         SELECT
           to_char(m.month_start, 'YYYY-MM') AS month,
           COALESCE(e.gross_cents, 0)::bigint AS gross_cents,
           COALESCE(e.net_cents, 0)::bigint AS net_cents,
           COALESCE(s.new_subscribers, 0)::bigint AS new_subscribers,
           COALESCE(c.canceled_subscribers, 0)::bigint AS canceled_subscribers
         FROM months m
         LEFT JOIN earnings_by_month e ON e.month_start = m.month_start
         LEFT JOIN subs_by_month s ON s.month_start = m.month_start
         LEFT JOIN cancellations_by_month c ON c.month_start = m.month_start
         ORDER BY m.month_start ASC`,
        [session.userId, MONTHS_OF_HISTORY]
      ),
    ]);

    const monthly = monthlyResult.rows.map((row) => ({
      month: row.month,
      grossCents: Number(row.gross_cents),
      netCents: Number(row.net_cents),
      newSubscribers: Number(row.new_subscribers),
      canceledSubscribers: Number(row.canceled_subscribers),
      netNewSubscribers: Number(row.new_subscribers) - Number(row.canceled_subscribers),
    }));

    const everSubscribed = churnResult.rows[0]?.ever_subscribed ?? 0;
    const everCanceled = churnResult.rows[0]?.ever_canceled ?? 0;
    const churnRatePercent = everSubscribed > 0 ? Math.round((everCanceled / everSubscribed) * 1000) / 10 : 0;

    const personalTierFeePercent = feeResult.rows[0]?.platform_fee_percent ?? STANDARD_FEE_PERCENT;
    // The fee tier is decided by THIS CALENDAR MONTH's earnings, not lifetime — `monthly`
    // above is already a zero-filled trailing series ending on the current month, so its
    // last entry is exactly that month-to-date figure. Reused here rather than a second query.
    const monthToDateGrossCents = monthly.length > 0 ? monthly[monthly.length - 1].grossCents : 0;

    return NextResponse.json({
      feePercent: personalTierFeePercent,
      effectiveFeePercent: applyPlatformMilestoneReduction(personalTierFeePercent, reductionPoints),
      platformReductionPoints: reductionPoints,
      discountedFeePercent: DISCOUNTED_FEE_PERCENT,
      thresholdCents: FEE_DISCOUNT_THRESHOLD_CENTS,
      monthToDateGrossCents,
      lifetimeGrossCents: Number(lifetimeResult.rows[0].gross_cents),
      lifetimeNetCents: Number(lifetimeResult.rows[0].net_cents),
      // Kept for backward compatibility with anything still reading the old field name.
      lifetimeEarningsCents: Number(lifetimeResult.rows[0].gross_cents),
      activeSubscriberCount: subscriberResult.rows[0]?.count ?? 0,
      everSubscribedCount: everSubscribed,
      churnRatePercent,
      monthly,
    });
  } catch (err) {
    console.error('creator/earnings GET failed:', err);
    return NextResponse.json({ error: 'Could not load your earnings.' }, { status: 500 });
  }
}
