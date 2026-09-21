export const dynamic = 'force-dynamic';

// GET /api/admin/accounting/export?report=statements&period=2026-09
// CSV downloads for every tab on /admin/accounting. See lib/accounting/csv.js.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { parsePeriod } from '@/lib/accounting/reports';
import { buildExport } from '@/lib/accounting/csv';

export async function GET(request) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const period = parsePeriod(searchParams.get('period') || undefined);
  try {
    const result = await buildExport(searchParams.get('report'), period);
    if (!result) return NextResponse.json({ error: 'Unknown report.' }, { status: 400 });
    return new NextResponse(result.csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('accounting export failed:', error);
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 });
  }
}
