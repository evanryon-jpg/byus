export const dynamic = 'force-dynamic';

// GET /api/feed/:token/media/:postId
// Serves the image or video for one post inside a private feed (see
// app/api/feed/[token]/route.js) -- referenced from that feed's <img> tags and
// <enclosure> elements. A podcast app or feed reader fetches this directly with no
// session cookie, so access is proven entirely by the feed token in the URL, exactly
// like the feed route itself.
//
// Video (Mux) posts 302-redirect to a freshly-signed Mux playback URL, minted at
// request time -- never embedded directly in the feed XML, because a signed Mux
// token is short-lived (see lib/mux-jwt.js) and could easily go stale between when a
// podcast app fetches the feed and when it actually plays an episode. Images stream
// straight from private Blob storage, the same way app/api/posts/[postId]/media does
// for the logged-in website.

import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { query } from '@/lib/db';
import { resolveFeedToken } from '@/lib/feed-token';
import { signPlaybackToken } from '@/lib/mux-jwt';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

export async function GET(request, { params }) {
  const { token, postId } = params;

  const rateLimitResult = await checkRateLimit('feed-fetch', `ip:${getClientIp(request)}`);
  if (!rateLimitResult.success) return rateLimitResponse(rateLimitResult);

  try {
    const resolved = await resolveFeedToken(token);
    if (!resolved || !resolved.hasActiveSubscription) {
      // Same rule as the feed itself: an unknown token or a lapsed subscription
      // gets no media, full stop -- there's no "public post" exception here the way
      // there is on the website, because this whole feed only exists for someone
      // who already has full subscriber access to everything in it.
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const postResult = await query(
      `SELECT creator_id, media_url, mux_playback_id, pending_review FROM posts WHERE id = $1`,
      [postId]
    );
    const post = postResult.rows[0];
    // The post has to actually belong to this token's creator -- otherwise a valid
    // feed token for creator A could be used to pull media out of any postId at all,
    // including ones belonging to a completely different creator.
    if (!post || post.creator_id !== resolved.creatorId || post.pending_review) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    if (post.mux_playback_id) {
      const signedToken = signPlaybackToken(post.mux_playback_id);
      return NextResponse.redirect(
        `https://stream.mux.com/${post.mux_playback_id}.m3u8?token=${signedToken}`,
        { status: 302 }
      );
    }

    if (!post.media_url) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const result = await get(post.media_url, { access: 'private' });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        // Unlike the logged-in website route this mirrors, this one's URL is stable
        // and access-scoped by the token rather than a session, so a feed reader
        // caching this response for a while is fine -- and expected, since that's
        // exactly how podcast apps normally treat episode artwork/media.
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('feed/[token]/media/[postId] GET failed:', err);
    return NextResponse.json({ error: 'Could not load this file.' }, { status: 500 });
  }
}
