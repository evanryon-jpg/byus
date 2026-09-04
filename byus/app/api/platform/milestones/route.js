export const dynamic = 'force-dynamic';

// GET /api/platform/milestones
// Public, no auth — powers the homepage growth gauge. Returns ByUs's own lifetime fee
// income (not creators' gross revenue — what the platform itself has actually earned)
// and the 4 milestones that permanently lower every creator's effective fee as that
// number grows. See lib/fees.js for where a milestone actually gets crossed.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [totalResult, milestonesResult] = await Promise.all([
      query(
        `SELECT COALESCE(ROUND(SUM(amount_cents * fee_percent_applied) / 100.0), 0)::bigint AS total
         FROM creator_earnings`
      ),
      query(
        `SELECT threshold_cents, reduction_points, crossed_at
         FROM platform_milestones ORDER BY threshold_cents ASC`
      ),
    ]);

    const platformFeeIncomeCents = Number(totalResult.rows[0].total);
    const milestones = milestonesResult.rows.map((row) => ({
      thresholdCents: Number(row.threshold_cents),
      reductionPoints: row.reduction_points,
      crossedAt: row.crossed_at,
    }));

    return NextResponse.json({ platformFeeIncomeCents, milestones });
  } catch (err) {
    console.error('platform/milestones GET failed:', err);
    return NextResponse.json({ error: 'Could not load platform milestones.' }, { status: 500 });
  }
}
