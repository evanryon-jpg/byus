// Backs the resumable version of "creator emails every active subscriber" -- see
// database/migrations/20260918_broadcast_jobs.sql for the two tables this reads and
// writes, and that file's header comment for why this exists.

import { query, withTransaction } from '@/lib/db';
import { getResendClient, buildCreatorUpdateEmailContent, BATCH_CHUNK_SIZE_EXPORTED as BATCH_CHUNK_SIZE } from '@/lib/email';

// A claim a worker picked up but never reported back on (crashed invocation, killed
// function) is abandoned after this long and made eligible to be claimed again.
const STALE_CLAIM_MINUTES = 5;

// How many recipient rows get inserted per statement when a job is created. A single
// 800,000-row INSERT...SELECT unnest() would work, but chunking keeps any one query's
// memory/time footprint modest on a small Neon compute size instead of doing the whole
// thing in one shot.
const RECIPIENT_INSERT_CHUNK = 20_000;

// Creates a broadcast job and snapshots its full recipient list, then returns the new
// job's id. Call processBroadcastJobChunk right after this so a normal-sized send still
// completes inline in the same request, exactly like the old synchronous version did.
export async function createBroadcastJob({ creatorId, creatorName, subject, message, recipients }) {
  const jobId = await withTransaction(async (client) => {
    const jobResult = await client.query(
      `INSERT INTO broadcast_jobs (creator_id, kind, creator_name, subject, message, total_recipients)
       VALUES ($1, 'creator_update', $2, $3, $4, $5)
       RETURNING id`,
      [creatorId, creatorName, subject, message, recipients.length]
    );
    const newJobId = jobResult.rows[0].id;

    for (let i = 0; i < recipients.length; i += RECIPIENT_INSERT_CHUNK) {
      const chunk = recipients.slice(i, i + RECIPIENT_INSERT_CHUNK);
      await client.query(
        `INSERT INTO broadcast_job_recipients (job_id, email)
         SELECT $1, email FROM unnest($2::text[]) AS email`,
        [newJobId, chunk]
      );
    }

    return newJobId;
  });

  return jobId;
}

// Resets any claim this job has been sitting on past STALE_CLAIM_MINUTES back to
// pending, so a worker that crashed mid-chunk doesn't leave those recipients stuck
// forever (and doesn't let the job report itself "completed" while they're still
// unsent -- see the remaining-count check at the bottom of processBroadcastJobChunk).
async function releaseStaleClaims(jobId) {
  await query(
    `UPDATE broadcast_job_recipients
     SET status = 'pending', claimed_at = NULL
     WHERE job_id = $1 AND status = 'sending'
       AND claimed_at < now() - interval '${STALE_CLAIM_MINUTES} minutes'`,
    [jobId]
  );
}

// Claims up to BATCH_CHUNK_SIZE pending recipients for this job and sends them as one
// Resend batch call, recording each row's outcome. Returns the chunk size actually
// claimed (0 means nothing left to do right now).
async function processOneChunk(jobId, resend, emailContent) {
  const claimed = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE broadcast_job_recipients
       SET status = 'sending', claimed_at = now()
       WHERE id IN (
         SELECT id FROM broadcast_job_recipients
         WHERE job_id = $1 AND status = 'pending'
         ORDER BY id
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, email`,
      [jobId, BATCH_CHUNK_SIZE]
    );
    return result.rows;
  });

  if (claimed.length === 0) return 0;

  let sendError = null;
  try {
    const { error } = await resend.batch.send(
      claimed.map((r) => ({ from: emailContent.from, to: r.email, subject: emailContent.subject, html: emailContent.html }))
    );
    sendError = error || null;
  } catch (err) {
    sendError = err;
  }

  const ids = claimed.map((r) => r.id);
  if (sendError) {
    console.error(`Broadcast job ${jobId}: chunk of ${claimed.length} failed to send:`, sendError);
    await query(
      `UPDATE broadcast_job_recipients
       SET status = 'failed', attempted_at = now(), error_message = $2
       WHERE id = ANY($1::bigint[])`,
      [ids, String(sendError.message || sendError).slice(0, 500)]
    );
    await query('UPDATE broadcast_jobs SET failed_count = failed_count + $2 WHERE id = $1', [jobId, claimed.length]);
  } else {
    await query(
      `UPDATE broadcast_job_recipients SET status = 'sent', attempted_at = now() WHERE id = ANY($1::bigint[])`,
      [ids]
    );
    await query('UPDATE broadcast_jobs SET sent_count = sent_count + $2 WHERE id = $1', [jobId, claimed.length]);
  }

  return claimed.length;
}

// Processes chunks of a job for up to `budgetMs`, then returns however far it got.
// Called both inline right after createBroadcastJob (short budget, so a typical-sized
// send finishes in the same request as before) and from the cron worker (a larger
// budget, to drain whatever a very large job still has left across many runs).
export async function processBroadcastJobChunk(jobId, { budgetMs = 8000 } = {}) {
  const startedAt = Date.now();

  const jobResult = await query(
    `SELECT id, creator_name, subject, message, status FROM broadcast_jobs WHERE id = $1`,
    [jobId]
  );
  const job = jobResult.rows[0];
  if (!job) return { done: true, found: false };
  if (job.status === 'completed') return { done: true, found: true };

  await releaseStaleClaims(jobId);

  const resend = getResendClient();
  const emailContent = buildCreatorUpdateEmailContent({
    creatorName: job.creator_name,
    subject: job.subject,
    message: job.message,
  });

  let processedThisRun = 0;
  // Always attempt at least one chunk even if budgetMs is tiny or already elapsed --
  // otherwise a very short inline budget could queue a job and process nothing at all.
  do {
    const claimedCount = await processOneChunk(jobId, resend, emailContent);
    if (claimedCount === 0) break;
    processedThisRun += claimedCount;
  } while (Date.now() - startedAt < budgetMs);

  const remainingResult = await query(
    `SELECT COUNT(*) FROM broadcast_job_recipients WHERE job_id = $1 AND status IN ('pending', 'sending')`,
    [jobId]
  );
  const remaining = Number(remainingResult.rows[0].count);

  let done = remaining === 0;
  if (done) {
    await query(
      `UPDATE broadcast_jobs SET status = 'completed', completed_at = now() WHERE id = $1 AND status != 'completed'`,
      [jobId]
    );
  }

  return { done, found: true, processedThisRun, remaining };
}

// Returns the current { sent, failed, total, status } for a job, or null if it doesn't
// exist. Used both by the initiating POST (to report where an inline-processed job
// landed) and by the dashboard's status-polling GET.
export async function getBroadcastJobStatus(jobId) {
  const result = await query(
    `SELECT sent_count, failed_count, total_recipients, status, creator_id
     FROM broadcast_jobs WHERE id = $1`,
    [jobId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    creatorId: row.creator_id,
    sent: row.sent_count,
    failed: row.failed_count,
    total: row.total_recipients,
    status: row.status,
  };
}

// All broadcast_jobs still in 'processing', oldest first -- what the cron worker drains
// each run. Capped so one cron invocation can't be handed an unbounded number of jobs to
// juggle inside its own time budget; anything past the cap just waits for the next run.
export async function listProcessingJobIds(limit = 25) {
  const result = await query(
    `SELECT id FROM broadcast_jobs WHERE status = 'processing' ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
  return result.rows.map((r) => r.id);
}
