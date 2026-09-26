export const dynamic = 'force-dynamic';

// GET /api/creator/video-storage -> { usedSeconds, limitSeconds, payingMembers, full }
// The creator's video storage use vs. allowance, for the meter on the dashboard.
// Rule: lib/video-limits.js.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getVideoStorage } from '@/lib/video-storage';

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Creators only.' }, { status: 403 });
  }
  try {
    return NextResponse.json(await getVideoStorage(session.userId));
  } catch (err) {
    console.error('creator/video-storage GET failed:', err);
    return NextResponse.json({ error: 'Could not load video storage.' }, { status: 500 });
  }
}
