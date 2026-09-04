export const dynamic = 'force-dynamic';

// GET /api/platform/milestones
// Public, no auth — powers the homepage growth gauge. Returns ByUs's own BEST CALENDAR
// MONTH of fee income yet (not creators' gross revenue — what the platform itself has
// actually earned in its strongest month so far, which reflects current scale better than
// a slow-climbing lifetime total) and the milestones tied to it. Most milestones
// permanently lower every creator's effective fee as that peak grows — see lib/fees.js for
// where a milestone actually gets crossed — but the top of the ladder can also include a
// milestone with reduction_points = 0: a "north star" marker shown on the same gauge for
// storytelling, with no further fee cut attached (see app/components/PlatformGoalGauge.jsx).

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [peakResult, milestonesResult] = await Promise.all([
      query(
        `SELECT COALESCE(MAX(month_total), 0)::bigint AS peak
         FROM (
           SELECT ROUND(SUM(amount_cents * fee_percent_applied) / 100.0) AS month_total
           FROM creator_earnings
           GROUP BY date_trunc('month', created_at)
         ) monthly`
      ),
      query(
        `SELECT threshold_cents, reduction_points, crossed_at
         FROM platform_milestones ORDER BY threshold_cents ASC`
      ),
    ]);

    const platformBestMonthCents = Number(peakResult.rows[0].peak);
    const milestones = milestonesResult.rows.map((row) => ({
      thresholdCents: Number(row.threshold_cents),
      reductionPoints: row.reduction_points,
      crossedAt: row.crossed_at,
    }));

    return NextResponse.json({ platformBestMonthCents, milestones });
  } catch (err) {
    console.error('platform/milestones GET failed:', err);
    return NextResponse.json({ error: 'Could not load platform milestones.' }, { status: 500 });
  }
}
