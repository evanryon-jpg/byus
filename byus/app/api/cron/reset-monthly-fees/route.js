export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { resetMonthlyEarnedFeeTiers } from '@/lib/fees';

// Vercel calls this at 00:00 UTC on the first day of each month (see vercel.json).
// It is deliberately authenticated with the same CRON_SECRET as the broadcast worker.
export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('reset-monthly-fees: CRON_SECRET is not set -- refusing to run unauthenticated.');
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const creatorsUpdated = await resetMonthlyEarnedFeeTiers();
    return NextResponse.json({ ok: true, creatorsUpdated });
  } catch (error) {
    console.error('reset-monthly-fees failed:', error);
    return NextResponse.json({ error: 'Could not reset monthly fee tiers.' }, { status: 500 });
  }
}
