export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { runAccountingSync } from '@/lib/accounting/sync';
import { alertOps } from '@/lib/alerts';

// Vercel calls this daily (see vercel.json) to copy the latest Stripe balance
// transactions, creator payouts and balances into the accounting ledger that
// /admin/accounting reads. Same CRON_SECRET auth pattern as the other cron routes.
export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('accounting-sync: CRON_SECRET is not set -- refusing to run unauthenticated.');
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await runAccountingSync();
    return NextResponse.json(result);
  } catch (error) {
    console.error('accounting-sync failed:', error);
    await alertOps('cron:accounting-sync', error).catch(() => {});
    return NextResponse.json({ error: 'Accounting sync failed.' }, { status: 500 });
  }
}
