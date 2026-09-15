export const dynamic = 'force-dynamic';

// GET /api/fan/connections
// Returns the signed-in fan's connected Discord/Telegram accounts (or null for
// whichever isn't connected), for the "Connected accounts" card in Settings.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans have connected accounts.' }, { status: 403 });
  }

  const result = await query(
    `SELECT provider, provider_user_id, provider_username FROM platform_connections WHERE user_id = $1`,
    [session.userId]
  );

  const byProvider = { discord: null, telegram: null };
  for (const row of result.rows) {
    byProvider[row.provider] = row;
  }
  return NextResponse.json(byProvider);
}
