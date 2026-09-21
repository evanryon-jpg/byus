export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// POST /api/admin/accounting/sync -- the "Sync now" button on /admin/accounting.
// Read-only against Stripe; see lib/accounting/sync.js.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { runAccountingSync } from '@/lib/accounting/sync';

export async function POST() {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  try {
    const result = await runAccountingSync();
    return NextResponse.json(result, { status: result.skipped ? 409 : 200 });
  } catch (error) {
    console.error('admin accounting sync failed:', error);
    return NextResponse.json({ error: error.message || 'Sync failed.' }, { status: 500 });
  }
}
