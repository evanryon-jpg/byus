export const dynamic = 'force-dynamic';

// GET  /api/creator/posts   -> list the logged-in creator's own posts (all of them, own view)
// POST /api/creator/posts   -> create a new post, public or subscribers-only

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getPollVoteCounts, buildPollPayload } from '@/lib/polls';

const TITLE_MAX = 200;
const BODY_MAX = 20000;
const POLL_MIN_OPTIONS = 2;
const POLL_MAX_OPTIONS = 4;
const POLL_OPTION_MAX = 80;

// Trims and validates a creator's raw poll option input. Returns null for "not a
// poll" (no options submitted at all) so callers can tell that apart from a poll with
// too few/invalid options, which throws instead.
function normalizePollOptions(pollOptions) {
  if (!Array.isArray(pollOptions) || pollOptions.length === 0) return null;
  const cleaned = pollOptions.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
  if (cleaned.length < POLL_MIN_OPTIONS) {
    throw new Error(`A poll needs at least ${POLL_MIN_OPTIONS} options.`);
  }
  if (cleaned.length > POLL_MAX_OPTIONS) {
    throw new Error(`A poll can have at most ${POLL_MAX_OPTIONS} options.`);
  }
  if (cleaned.some((o) => o.length > POLL_OPTION_MAX)) {
    throw new Error(`Each poll option must be ${POLL_OPTION_MAX} characters or fewer.`);
  }
  return cleaned;
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can view this.' }, { status: 403 });
  }

  try {
    const result = await query(
      `SELECT id, title, body, media_url, visibility, poll_options, created_at
       FROM posts WHERE creator_id = $1 ORDER BY created_at DESC`,
      [session.userId]
    );
    const pollPostIds = result.rows.filter((p) => p.poll_options).map((p) => p.id);
    const voteCounts = await getPollVoteCounts(pollPostIds);

    // media_url in the DB is a private Blob pathname, never expose it directly —
    // point the client at our own gated route instead.
    const posts = result.rows.map((post) => ({
      ...post,
      media_url: post.media_url ? `/api/posts/${post.id}/media` : null,
      poll: buildPollPayload(post, voteCounts[post.id]),
    }));
    return NextResponse.json({ posts });
  } catch (err) {
    console.error('creator/posts GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load your posts. Try again.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can post.' }, { status: 403 });
  }

  const { title, body, mediaUrl, visibility, pollOptions } = await request.json();

  if (!body) {
    return NextResponse.json({ error: 'Post body is required.' }, { status: 400 });
  }
  if (title && title.length > TITLE_MAX) {
    return NextResponse.json(
      { error: `Title must be ${TITLE_MAX} characters or fewer.` },
      { status: 400 }
    );
  }
  if (body.length > BODY_MAX) {
    return NextResponse.json(
      { error: `Post body must be ${BODY_MAX} characters or fewer.` },
      { status: 400 }
    );
  }

  let cleanedPollOptions;
  try {
    cleanedPollOptions = normalizePollOptions(pollOptions);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  // mediaUrl here is actually the private Blob pathname returned by
  // /api/creator/upload — that route always writes pathnames scoped as
  // posts/{userId}/{uuid}.{ext}, so a genuine pathname for THIS creator always
  // starts with their own prefix. Rejecting anything else stops a leaked or
  // guessed pathname belonging to a different creator (or a different post
  // type, like an avatar) from being attached here as if it were this
  // creator's own upload.
  if (mediaUrl && !mediaUrl.startsWith(`posts/${session.userId}/`)) {
    return NextResponse.json({ error: 'Invalid media reference.' }, { status: 400 });
  }
  const finalVisibility = visibility === 'subscribers_only' ? 'subscribers_only' : 'public';

  try {
    // mediaUrl here is actually the private Blob pathname returned by
    // /api/creator/upload, stored as-is — it's only ever resolved back into
    // real file bytes through the gated /api/posts/:id/media route.
    const result = await query(
      `INSERT INTO posts (creator_id, title, body, media_url, visibility, poll_options)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, body, media_url, visibility, poll_options, created_at`,
      [
        session.userId,
        title || null,
        body,
        mediaUrl || null,
        finalVisibility,
        cleanedPollOptions ? JSON.stringify(cleanedPollOptions) : null,
      ]
    );

    const post = result.rows[0];
    return NextResponse.json({
      post: {
        ...post,
        media_url: post.media_url ? `/api/posts/${post.id}/media` : null,
        poll: buildPollPayload(post, {}),
      },
    });
  } catch (err) {
    console.error('creator/posts POST failed:', err);
    return NextResponse.json(
      { error: 'Could not create this post. Try again.' },
      { status: 500 }
    );
  }
}
