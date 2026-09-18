export const dynamic = 'force-dynamic';

// GET /api/feed/:token
// A private, per-subscriber RSS/podcast feed -- paste this URL into Apple Podcasts,
// Overcast, Pocket Casts, or any RSS reader to get one creator's posts delivered
// automatically, with no ByUs login involved. The token in the URL itself IS the
// credential (see lib/feed-token.js and database/migrations/20260918_fan_feed_tokens.sql)
// -- a podcast app has nowhere to put a session cookie, so unlike every other
// fan-facing route in this app, this one deliberately does NOT call getCurrentUser().
//
// This is the OUTBOUND counterpart to the existing lib/rss.js / app/api/creator/rss
// feature -- that one pulls a creator's own external blog feed INTO ByUs as posts;
// this one generates a feed OUT of ByUs for a subscriber's own podcast app. They don't
// share any code -- lib/rss.js only ever parses XML, it never writes any.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { resolveFeedToken, escapeXml } from '@/lib/feed-token';
import { publicAvatarUrl } from '@/lib/avatar-url';
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

const MAX_ITEMS = 100;

function xmlResponse(xml) {
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      // Podcast apps and feed readers poll on their own schedule (often every
      // 15-60 minutes) -- a short cache still saves real load if several of a
      // fan's apps (phone, laptop, tablet) all happen to poll within a minute of
      // each other, without meaningfully delaying a genuinely new post.
      'Cache-Control': 'public, max-age=300',
    },
  });
}

// A feed reader that hits an unexpected error or a truly unknown token still gets
// back *some* valid RSS (rather than a JSON error body or a blank 404 page) --
// most feed readers show that error text directly to the person as the "feed", which
// is a far better experience than a generic parse-failure message.
function errorFeed(title, message, status) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeXml(title)}</title>
<description>${escapeXml(message)}</description>
</channel></rss>`;
  return new NextResponse(xml, {
    status,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}

export async function GET(request, { params }) {
  const { token } = params;

  const rateLimitResult = await checkRateLimit('feed-fetch', `ip:${getClientIp(request)}`);
  if (!rateLimitResult.success) return rateLimitResponse(rateLimitResult);

  try {
    const resolved = await resolveFeedToken(token);
    if (!resolved) {
      return errorFeed('Feed not found', 'This feed link is invalid or has been reset.', 404);
    }

    const { creator, hasActiveSubscription } = resolved;
    const origin = process.env.APP_URL || 'https://byusapp.com';
    const creatorLink = `${origin}/creator/${creator.slug || creator.id}`;
    const avatarUrl = publicAvatarUrl(creator.id, creator.profile_image_url);
    const channelImage = avatarUrl ? `${origin}${avatarUrl}` : null;

    if (!hasActiveSubscription) {
      // A lapsed/canceled subscription doesn't delete the token row -- it just stops
      // this feed from handing out subscriber-only content, same as the website
      // itself would. Still 200 with valid (empty) RSS rather than an error status,
      // so the feed doesn't just vanish from someone's app with no explanation --
      // they see this note instead of new episodes.
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeXml(creator.display_name || 'ByUs creator')} on ByUs</title>
<link>${escapeXml(creatorLink)}</link>
<description>Your subscription to ${escapeXml(
        creator.display_name || 'this creator'
      )} on ByUs isn't currently active, so new posts aren't coming through this feed. Resubscribe at ${escapeXml(
        creatorLink
      )} to start receiving them again.</description>
</channel></rss>`;
      return xmlResponse(xml);
    }

    // pending_review posts are never visible anywhere, including here -- same rule
    // as the public profile page. An active subscriber can see both public and
    // subscribers-only posts, so unlike the profile page's per-post gate, there's
    // nothing to lock here at all: this whole feed only exists for someone who
    // already has full access to everything in it.
    const postsResult = await query(
      `SELECT id, title, body, media_url, mux_playback_id, created_at
       FROM posts
       WHERE creator_id = $1 AND pending_review = false
       ORDER BY created_at DESC
       LIMIT $2`,
      [creator.id, MAX_ITEMS]
    );

    const items = postsResult.rows
      .map((post) => {
        const link = `${creatorLink}#post-${post.id}`;
        const pubDate = new Date(post.created_at).toUTCString();
        const titleTag = post.title ? `<title>${escapeXml(post.title)}</title>` : '';

        // Images are embedded inline in the description (standard blog-RSS
        // convention) rather than as an <enclosure> -- enclosures are really meant
        // for one big downloadable media file per item, which is right for video
        // but not for a post that's mostly text with an inline photo.
        const imageHtml =
          post.media_url && !post.mux_playback_id
            ? `<img src="${escapeXml(`${origin}/api/feed/${token}/media/${post.id}`)}" alt="" />`
            : '';
        const bodyHtml = post.body ? `<p>${escapeXml(post.body).replace(/\n/g, '<br/>')}</p>` : '';
        const description = `<![CDATA[${imageHtml}${bodyHtml}]]>`;

        // Video posts get a real <enclosure> so podcast apps treat them as an
        // episode to download/stream -- pointed at our own media-proxy route (see
        // app/api/feed/[token]/media/[postId]/route.js), which mints a fresh signed
        // Mux playback URL at request time rather than embedding one here that
        // could go stale before a podcast app actually fetches it.
        const enclosure = post.mux_playback_id
          ? `<enclosure url="${escapeXml(
              `${origin}/api/feed/${token}/media/${post.id}`
            )}" type="application/x-mpegURL" length="0" />`
          : '';

        return `<item>
${titleTag}
<link>${escapeXml(link)}</link>
<guid isPermaLink="false">${escapeXml(post.id)}</guid>
<pubDate>${pubDate}</pubDate>
<description>${description}</description>
${enclosure}
</item>`;
      })
      .join('\n');

    const channelTitle = `${creator.display_name || 'ByUs creator'} on ByUs`;
    const channelDescription = creator.bio || `${creator.display_name || 'This creator'}'s posts on ByUs.`;
    const imageTag = channelImage
      ? `<image><url>${escapeXml(channelImage)}</url><title>${escapeXml(
          channelTitle
        )}</title><link>${escapeXml(creatorLink)}</link></image>
<itunes:image href="${escapeXml(channelImage)}" />`
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
<title>${escapeXml(channelTitle)}</title>
<link>${escapeXml(creatorLink)}</link>
<description>${escapeXml(channelDescription)}</description>
<language>en-us</language>
<generator>ByUs</generator>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<itunes:author>${escapeXml(creator.display_name || 'ByUs creator')}</itunes:author>
${imageTag}
${items}
</channel>
</rss>`;

    return xmlResponse(xml);
  } catch (err) {
    console.error('feed/[token] GET failed:', err);
    return errorFeed('Feed temporarily unavailable', 'Something went wrong loading this feed. Try again shortly.', 500);
  }
}
