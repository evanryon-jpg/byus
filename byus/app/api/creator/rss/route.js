export const dynamic = 'force-dynamic';

// PATCH /api/creator/rss  -> set (or clear) the creator's blog RSS/Atom feed URL
// POST  /api/creator/rss  -> fetch that feed now and import any new entries as posts
//
// Manual sync only for now (a "Sync now" button in Settings) -- no scheduled/cron
// sync yet. See database/migrations/20260917_rss_import.sql for the columns this
// reads/writes and lib/rss.js for the feed parsing itself.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { parseFeed } from '@/lib/rss';
import { containsBlockedContent } from '@/lib/content-policy';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const FETCH_TIMEOUT_MS = 10000;
const URL_MAX = 2000;

function isPlausibleFeedUrl(value) {
  if (typeof value !== 'string' || value.length > URL_MAX) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function PATCH(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can manage a feed.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const raw = typeof body.feedUrl === 'string' ? body.feedUrl.trim() : '';
  if (raw && !isPlausibleFeedUrl(raw)) {
    return NextResponse.json({ error: "That doesn't look like a valid feed URL." }, { status: 400 });
  }

  // Clearing the URL also clears any stale error from a previous feed, so Settings
  // never shows an error for a feed that's no longer even configured.
  await query(
    `UPDATE users SET rss_feed_url = $1, rss_last_sync_error = NULL WHERE id = $2`,
    [raw || null, session.userId]
  );

  return NextResponse.json({ ok: true });
}

export async function POST() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can sync a feed.' }, { status: 403 });
  }

  const rateCheck = await checkRateLimit('rss-sync', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const userResult = await query('SELECT rss_feed_url, review_cleared_at FROM users WHERE id = $1', [
    session.userId,
  ]);
  const row = userResult.rows[0];
  const feedUrl = row?.rss_feed_url;
  if (!feedUrl) {
    return NextResponse.json({ error: 'Add a feed URL first.' }, { status: 400 });
  }

  let entries;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(feedUrl, {
        signal: controller.signal,
        // A few blog hosts (WordPress.com among them) reject requests with no
        // User-Agent outright -- a plain, identifiable one avoids that without
        // pretending to be a browser.
        headers: { 'User-Agent': 'ByUsBot/1.0 (+https://byusapp.com)' },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`Feed returned ${res.status}`);
    const xml = await res.text();
    entries = parseFeed(xml);
  } catch (err) {
    console.error(`rss sync fetch failed for creator ${session.userId}:`, err);
    const message = 'Could not read that feed. Check the URL and try again.';
    await query(`UPDATE users SET rss_last_synced_at = now(), rss_last_sync_error = $1 WHERE id = $2`, [
      message,
      session.userId,
    ]);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Same gate manual posts go through -- a creator ByUs hasn't reviewed yet gets
  // imported posts held out of public view too, same as anything they post by hand
  // (see the pending_review note in app/api/creator/posts/route.js).
  const pendingReview = !row.review_cleared_at;
  let imported = 0;
  let skippedBlocked = 0;

  for (const entry of entries) {
    const check = containsBlockedContent(entry.title, entry.body);
    if (check.blocked) {
      skippedBlocked += 1;
      continue;
    }

    const postBody = entry.link ? `${entry.body}\n\nRead the original post: ${entry.link}` : entry.body;
    try {
      const result = await query(
        `INSERT INTO posts (creator_id, title, body, visibility, pending_review, rss_guid, created_at)
         VALUES ($1, $2, $3, 'public', $4, $5, COALESCE($6, now()))
         ON CONFLICT (creator_id, rss_guid) WHERE rss_guid IS NOT NULL DO NOTHING
         RETURNING id`,
        [session.userId, entry.title, postBody, pendingReview, entry.guid, entry.publishedAt]
      );
      if (result.rows[0]) imported += 1;
    } catch (err) {
      console.error(`rss sync insert failed for creator ${session.userId}, entry ${entry.guid}:`, err);
    }
  }

  await query(`UPDATE users SET rss_last_synced_at = now(), rss_last_sync_error = NULL WHERE id = $1`, [
    session.userId,
  ]);

  return NextResponse.json({ imported, checked: entries.length, skippedBlocked });
}
