export const dynamic = 'force-dynamic';

// POST /api/posts/:postId/vote
// Casts (or changes) the logged-in viewer's vote on a poll post. Uses the exact same
// access rule as the post's own body/media: public posts are open to anyone logged in,
// subscribers-only posts require an active subscription -- you can't vote on results
// you weren't allowed to see in the first place.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getPollVoteCounts, buildPollPayload } from '@/lib/polls';

export async function POST(request, { params }) {
  const { postId } = params;
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Log in to vote.' }, { status: 401 });
  }

  const { optionIndex } = await request.json();

  try {
    const postResult = await query(
      `SELECT id, creator_id, visibility, poll_options FROM posts WHERE id = $1`,
      [postId]
    );
    const post = postResult.rows[0];
    if (!post || !post.poll_options) {
      return NextResponse.json({ error: 'This poll no longer exists.' }, { status: 404 });
    }

    if (
      !Number.isInteger(optionIndex) ||
      optionIndex < 0 ||
      optionIndex >= post.poll_options.length
    ) {
      return NextResponse.json({ error: 'Invalid option.' }, { status: 400 });
    }

    const isOwner = session.userId === post.creator_id;
    let isAuthorized = post.visibility === 'public' || isOwner;
    if (!isAuthorized) {
      // Same reconciling check used everywhere else content is gated: trust the
      // paid-through date over the cached status column in case a webhook was missed.
      const subResult = await query(
        `SELECT id FROM subscriptions
         WHERE fan_id = $1 AND creator_id = $2 AND status = 'active'
           AND (current_period_end IS NULL OR current_period_end > now())`,
        [session.userId, post.creator_id]
      );
      isAuthorized = subResult.rows.length > 0;
    }
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'You need an active subscription to vote on this.' },
        { status: 403 }
      );
    }

    // One vote per (post, fan): a second vote just moves it rather than being rejected
    // outright -- simpler for people who tap the wrong option than a "you already voted"
    // dead end would be.
    await query(
      `INSERT INTO poll_votes (post_id, fan_id, option_index)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, fan_id) DO UPDATE SET option_index = EXCLUDED.option_index`,
      [postId, session.userId, optionIndex]
    );

    const counts = await getPollVoteCounts([postId]);
    const poll = buildPollPayload(post, counts[postId], optionIndex);

    return NextResponse.json({ poll });
  } catch (err) {
    console.error('posts/[postId]/vote POST failed:', err);
    return NextResponse.json({ error: 'Could not record your vote. Try again.' }, { status: 500 });
  }
}
