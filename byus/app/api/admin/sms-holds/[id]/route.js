export const dynamic = 'force-dynamic';

// POST /api/admin/sms-holds/[id] -> { action: 'approve' | 'reject' }
// Rate-limited with admin-payment-action rather than admin-write -- approving one of
// these actually spends real money against the sent.dm balance (see lib/sms-holds.js),
// the same reason app/api/admin/payments/refund/route.js uses that tighter limiter
// instead of the general admin-write one.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { approveSmsBroadcastHold, rejectSmsBroadcastHold } from '@/lib/sms-holds';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request, { params }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid hold.' }, { status: 400 });
  }

  const rateCheck = await checkRateLimit('admin-payment-action', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { action } = await request.json().catch(() => ({}));
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject".' }, { status: 400 });
  }

  try {
    const result = action === 'approve'
      ? await approveSmsBroadcastHold(params.id, session.userId)
      : await rejectSmsBroadcastHold(params.id, session.userId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(`admin/sms-holds/${params.id} POST (${action}) failed:`, err);
    return NextResponse.json({ error: 'Could not process that hold. Try again.' }, { status: 500 });
  }
}
