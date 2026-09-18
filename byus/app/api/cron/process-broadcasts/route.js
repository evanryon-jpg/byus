export const dynamic = 'force-dynamic';
// Vercel Cron (see vercel.json) hits this on a schedule to drain whatever's left of any
// broadcast job too large to finish inline in app/api/creator/broadcast/route.js's own
// request. 60s gives each run real headroom to make a dent in a very large job without
// needing Fluid Compute's higher ceiling -- raise this later if a single subscriber
// base grows large enough that even that isn't enough runway between runs.
export const maxDuration = 60;

// GET /api/cron/process-broadcasts
// Requires a CRON_SECRET environment variable in the Vercel project (Production).
// When that variable is set, Vercel automatically sends it as this request's
// `Authorization: Bearer <value>` header -- nothing else needs to configure that part.
// Without it, this route refuses every request rather than running unauthenticated:
// this is the one thing left to add in the Vercel dashboard for this system to be live.

import { NextResponse } from 'next/server';
import { listProcessingJobIds, processBroadcastJobChunk } from '@/lib/broadcast-jobs';

// Leaves headroom below maxDuration for the function's own cold start, the final
// listProcessingJobIds query, and response overhead.
const TOTAL_BUDGET_MS = 50_000;
// Cap on how many jobs one run touches, matching listProcessingJobIds' own default --
// keeps a single run from being spread so thin across many jobs that none of them
// makes meaningful progress.
const MAX_JOBS_PER_RUN = 25;

export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('process-broadcasts: CRON_SECRET is not set -- refusing to run unauthenticated.');
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const startedAt = Date.now();
  const jobIds = await listProcessingJobIds(MAX_JOBS_PER_RUN);

  const results = [];
  for (const jobId of jobIds) {
    const elapsed = Date.now() - startedAt;
    const remaining = TOTAL_BUDGET_MS - elapsed;
    if (remaining <= 0) break;

    // Give each job a slice of whatever's left, not the full remaining budget -- so one
    // very large, still-far-from-done job can't starve every other job queued behind it
    // in the same run.
    const jobBudget = Math.min(remaining, Math.max(5000, Math.floor(remaining / (jobIds.length - results.length))));
    try {
      const outcome = await processBroadcastJobChunk(jobId, { budgetMs: jobBudget });
      results.push({ jobId, ...outcome });
    } catch (err) {
      console.error(`process-broadcasts: job ${jobId} failed this run (will retry next run):`, err);
      results.push({ jobId, error: true });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
