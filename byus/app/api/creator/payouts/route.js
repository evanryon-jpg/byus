export const dynamic = 'force-dynamic';

// GET /api/creator/payouts
// Tax-and-reporting view of a creator's earnings: the same underlying ledger as
// /api/creator/earnings, but grouped by CALENDAR YEAR instead of trailing months —
// the shape that actually matters for tax season (Stripe's own 1099-K, issued directly
// by Stripe to the creator on their connected account, is a calendar-year form). This
// route doesn't generate or file anything itself; it just gives the creator an
// always-available, ByUs-side view of the same numbers so they're never stuck waiting
// on Stripe's dashboard to reconcile what they were paid.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Creators only.' }, { status: 403 });
  }

  try {
    const yearsResult = await query(
      `SELECT
         EXTRACT(YEAR FROM created_at)::int AS year,
         COUNT(*)::int AS payment_count,
         COALESCE(SUM(amount_cents), 0)::bigint AS gross_cents,
         COALESCE(ROUND(SUM(amount_cents * fee_percent_applied) / 100.0), 0)::bigint AS fee_cents,
         COALESCE(ROUND(SUM(amount_cents * (100 - fee_percent_applied)) / 100.0), 0)::bigint AS net_cents
       FROM creator_earnings
       WHERE creator_id = $1
       GROUP BY 1
       ORDER BY 1 DESC`,
      [session.userId]
    );

    const years = yearsResult.rows.map((row) => ({
      year: row.year,
      paymentCount: row.payment_count,
      grossCents: Number(row.gross_cents),
      feeCents: Number(row.fee_cents),
      netCents: Number(row.net_cents),
    }));

    const lifetimeGrossCents = years.reduce((sum, y) => sum + y.grossCents, 0);
    const lifetimeNetCents = years.reduce((sum, y) => sum + y.netCents, 0);

    return NextResponse.json({ years, lifetimeGrossCents, lifetimeNetCents });
  } catch (err) {
    console.error('creator/payouts GET failed:', err);
    return NextResponse.json({ error: 'Could not load your payout history.' }, { status: 500 });
  }
}
