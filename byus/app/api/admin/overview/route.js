export const dynamic = 'force-dynamic';

// GET /api/admin/overview
// Platform-wide numbers for the owner: what ByUs itself has earned (not just what
// creators have earned), how many creators/fans have signed up, active subscriptions,
// a 12-month trailing series for the dashboard's charts, and a recent-creators list for
// spotting problem accounts (never onboarded Stripe, zero earnings after weeks, etc).
// Gated by lib/admin.js's email allowlist rather than the `role` column — see that file
// for why.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';

const MONTHS_OF_HISTORY = 12;
const RECENT_CREATORS_LIMIT = 25;
const RECENT_DISPUTES_LIMIT = 25;
// Stripe's terminal dispute statuses -- everything else ('needs_response',
// 'under_review', 'warning_needs_response', etc.) still needs a human to look at it.
const CLOSED_DISPUTE_STATUSES = ['won', 'lost'];

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  try {
    const [counts, activeSubs, lifetime, monthlyResult, recentCreators, openDisputes, recentDisputes] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE role = 'creator')::int AS creator_count,
           COUNT(*) FILTER (WHERE role = 'fan')::int AS fan_count
         FROM users`
      ),
      query(`SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'active'`),
      query(
        `SELECT
           COALESCE(SUM(amount_cents), 0)::bigint AS gross_cents,
           COALESCE(ROUND(SUM(amount_cents * fee_percent_applied) / 100.0), 0)::bigint AS platform_fee_cents
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
             ROUND(SUM(amount_cents * fee_percent_applied) / 100.0) AS platform_fee_cents
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
         )
         SELECT
           to_char(m.month_start, 'YYYY-MM') AS month,
           COALESCE(e.gross_cents, 0)::bigint AS gross_cents,
           COALESCE(e.platform_fee_cents, 0)::bigint AS platform_fee_cents,
           COALESCE(s.new_creators, 0)::bigint AS new_creators,
           COALESCE(s.new_fans, 0)::bigint AS new_fans
         FROM months m
         LEFT JOIN earnings_by_month e ON e.month_start = m.month_start
         LEFT JOIN signups_by_month s ON s.month_start = m.month_start
         ORDER BY m.month_start ASC`,
        [MONTHS_OF_HISTORY]
      ),
      query(
        `SELECT
           u.id, u.display_name, u.email, u.created_at, u.stripe_connect_onboarded,
           u.platform_fee_percent, COALESCE(e.gross_cents, 0)::bigint AS lifetime_gross_cents
         FROM users u
         LEFT JOIN (
           SELECT creator_id, SUM(amount_cents) AS gross_cents
           FROM creator_earnings GROUP BY creator_id
         ) e ON e.creator_id = u.id
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
           d.id, d.amount_cents, d.currency, d.reason, d.status, d.opened_at, d.closed_at,
           creator.display_name AS creator_name, creator.email AS creator_email,
           fan.display_name AS fan_name, fan.email AS fan_email
         FROM stripe_disputes d
         LEFT JOIN users creator ON creator.id = d.creator_id
         LEFT JOIN users fan ON fan.id = d.fan_id
         ORDER BY d.opened_at DESC
         LIMIT $1`,
        [RECENT_DISPUTES_LIMIT]
      ),
    ]);

    const monthly = monthlyResult.rows.map((row) => ({
      month: row.month,
      grossCents: Number(row.gross_cents),
      platformFeeCents: Number(row.platform_fee_cents),
      newCreators: Number(row.new_creators),
      newFans: Number(row.new_fans),
    }));

    const creators = recentCreators.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      createdAt: row.created_at,
      stripeConnectOnboarded: row.stripe_connect_onboarded,
      platformFeePercent: row.platform_fee_percent,
      lifetimeGrossCents: Number(row.lifetime_gross_cents),
    }));

    const disputes = recentDisputes.rows.map((row) => ({
      id: row.id,
      amountCents: row.amount_cents,
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      creatorName: row.creator_name,
      creatorEmail: row.creator_email,
      fanName: row.fan_name,
      fanEmail: row.fan_email,
    }));

    return NextResponse.json({
      creatorCount: counts.rows[0].creator_count,
      fanCount: counts.rows[0].fan_count,
      activeSubscriberCount: activeSubs.rows[0].count,
      lifetimeGrossCents: Number(lifetime.rows[0].gross_cents),
      lifetimePlatformFeeCents: Number(lifetime.rows[0].platform_fee_cents),
      openDisputeCount: openDisputes.rows[0].count,
      monthly,
      creators,
      disputes,
    });
  } catch (err) {
    console.error('admin/overview GET failed:', err);
    return NextResponse.json({ error: 'Could not load platform overview.' }, { status: 500 });
  }
}
