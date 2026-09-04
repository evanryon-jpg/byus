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

export async function GET() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  try {
    const [counts, activeSubs, lifetime, monthlyResult, recentCreators] = await Promise.all([
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

    return NextResponse.json({
      creatorCount: counts.rows[0].creator_count,
      fanCount: counts.rows[0].fan_count,
      activeSubscriberCount: activeSubs.rows[0].count,
      lifetimeGrossCents: Number(lifetime.rows[0].gross_cents),
      lifetimePlatformFeeCents: Number(lifetime.rows[0].platform_fee_cents),
      monthly,
      creators,
    });
  } catch (err) {
    console.error('admin/overview GET failed:', err);
    return NextResponse.json({ error: 'Could not load platform overview.' }, { status: 500 });
  }
}
