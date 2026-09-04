export const dynamic = 'force-dynamic';

// GET /api/creator/earnings
// Read-only summary of the logged-in creator's lifetime gross revenue on ByUs and where
// that puts them on the platform fee tier — powers the small progress indicator on the
// creator dashboard. Purely informational: the actual fee (and the moment it drops) is
// decided in lib/fees.js, triggered off real Stripe payments in the webhook, never here.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { STANDARD_FEE_PERCENT, DISCOUNTED_FEE_PERCENT, FEE_DISCOUNT_THRESHOLD_CENTS } from '@/lib/stripe';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Creators only.' }, { status: 403 });
  }

  try {
    const [feeResult, earningsResult] = await Promise.all([
      query('SELECT platform_fee_percent FROM users WHERE id = $1', [session.userId]),
      query(
        'SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total FROM creator_earnings WHERE creator_id = $1',
        [session.userId]
      ),
    ]);

    return NextResponse.json({
      lifetimeEarningsCents: Number(earningsResult.rows[0].total),
      feePercent: feeResult.rows[0]?.platform_fee_percent ?? STANDARD_FEE_PERCENT,
      discountedFeePercent: DISCOUNTED_FEE_PERCENT,
      thresholdCents: FEE_DISCOUNT_THRESHOLD_CENTS,
    });
  } catch (err) {
    console.error('creator/earnings GET failed:', err);
    return NextResponse.json({ error: 'Could not load your earnings.' }, { status: 500 });
  }
}
