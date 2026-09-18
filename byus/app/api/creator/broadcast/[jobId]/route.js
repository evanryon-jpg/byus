export const dynamic = 'force-dynamic';

// GET /api/creator/broadcast/[jobId] -> how a queued broadcast is progressing.
// Polled by BroadcastSection in app/creator/dashboard/DashboardClient.js while a job
// is still 'processing' (the inline budget in the POST handler ran out before every
// recipient was sent, so the cron worker is finishing the rest in the background).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getBroadcastJobStatus } from '@/lib/broadcast-jobs';

export async function GET(request, { params }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can do this.' }, { status: 403 });
  }

  const jobId = Number(params.jobId);
  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 });
  }

  const job = await getBroadcastJobStatus(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Broadcast not found.' }, { status: 404 });
  }
  // A creator can only ever poll their own broadcast's progress, never anyone else's.
  if (job.creatorId !== session.userId) {
    return NextResponse.json({ error: 'Broadcast not found.' }, { status: 404 });
  }

  return NextResponse.json({
    sent: job.sent,
    failed: job.failed,
    total: job.total,
    status: job.status,
  });
}
