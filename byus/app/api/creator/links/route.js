export const dynamic = 'force-dynamic';

// GET /api/creator/links  -> list the logged-in creator's links
// PUT /api/creator/links  -> replace the full list in one save
//
// Stored as a single JSONB array on users.social_links rather than a separate table --
// a creator has at most a handful of these, always edits them as a set from the
// dashboard, and never needs to update just one without seeing the others.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const MAX_LINKS = 8;
const MAX_LABEL_LENGTH = 40;
const MAX_URL_LENGTH = 300;

// Friendly display names for common platforms, so pasting a bare URL is enough --
// a creator does not have to type a platform name just to get a nice-looking pill.
const KNOWN_PLATFORMS = {
    'tiktok.com': 'TikTok',
    'youtube.com': 'YouTube',
    'youtu.be': 'YouTube',
    'instagram.com': 'Instagram',
    'twitter.com': 'X (Twitter)',
    'x.com': 'X (Twitter)',
    'facebook.com': 'Facebook',
    'twitch.tv': 'Twitch',
    'patreon.com': 'Patreon',
    'discord.gg': 'Discord',
    'discord.com': 'Discord',
    'spotify.com': 'Spotify',
    'linkedin.com': 'LinkedIn',
    'threads.net': 'Threads',
    'snapchat.com': 'Snapchat',
    'pinterest.com': 'Pinterest',
    'github.com': 'GitHub',
};

function friendlyLabel(hostname) {
    const bare = hostname.replace(/^www\./, '');
    return KNOWN_PLATFORMS[bare] || bare;
}

export async function GET() {
    const session = await getCurrentUser();
    if (!session || session.role !== 'creator') {
          return NextResponse.json({ error: 'Only creators can view their links.' }, { status: 403 });
    }
    try {
          const result = await query('SELECT social_links FROM users WHERE id = $1', [session.userId]);
          return NextResponse.json({ links: result.rows[0]?.social_links || [] });
    } catch (err) {
          console.error('creator/links GET failed:', err);
          return NextResponse.json({ error: 'Could not load your links. Try again.' }, { status: 500 });
    }
}

export async function PUT(request) {
    const session = await getCurrentUser();
    if (!session || session.role !== 'creator') {
          return NextResponse.json({ error: 'Only creators can manage links.' }, { status: 403 });
    }

  const rateCheck = await checkRateLimit('creator-links', `user:${session.userId}`);
    if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { links } = await request.json();
    if (!Array.isArray(links)) {
          return NextResponse.json({ error: 'Links must be a list.' }, { status: 400 });
    }
    if (links.length > MAX_LINKS) {
          return NextResponse.json({ error: `You can add up to ${MAX_LINKS} links.` }, { status: 400 });
    }

  const cleaned = [];
    for (const raw of links) {
          const rawUrl = (raw?.url || '').trim();
          if (!rawUrl) continue; // skip blank rows instead of erroring -- easy to leave one empty while editing

      if (rawUrl.length > MAX_URL_LENGTH) {
              return NextResponse.json({ error: 'One of your links is too long.' }, { status: 400 });
      }

      // Let a creator paste a bare domain without typing a scheme themselves.
      const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

      let parsed;
          try {
                  parsed = new URL(withScheme);
          } catch {
                  return NextResponse.json({ error: `That link is not valid: ${rawUrl}` }, { status: 400 });
          }
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                  return NextResponse.json({ error: `That link is not valid: ${rawUrl}` }, { status: 400 });
          }

      const label = (raw?.label || '').trim().slice(0, MAX_LABEL_LENGTH) || friendlyLabel(parsed.hostname);
          cleaned.push({ label, url: parsed.toString() });
    }

  try {
        await query('UPDATE users SET social_links = $1 WHERE id = $2', [JSON.stringify(cleaned), session.userId]);
        return NextResponse.json({ links: cleaned });
  } catch (err) {
        console.error('creator/links PUT failed:', err);
        return NextResponse.json({ error: 'Could not save your links. Try again.' }, { status: 500 });
  }
}
