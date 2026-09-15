export const dynamic = 'force-dynamic';

// GET /api/auth/discord/callback
// Where Discord redirects back to after the fan approves (or denies) the OAuth
// consent screen from /api/auth/discord/start. Links the Discord account to whichever
// ByUs fan the `state` token names, then bounces back to Settings with a status flag
// the UI reads to show a success/error banner.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyConnectStateToken } from '@/lib/auth';
import { exchangeDiscordCode, getDiscordUser } from '@/lib/discord';
import { syncAllActiveSubscriptionsForFan } from '@/lib/platform-sync';

export async function GET(request) {
  const url = new URL(request.url);
  const settingsUrl = new URL('/settings', url.origin);

  if (url.searchParams.get('error')) {
    settingsUrl.searchParams.set('discordError', 'denied');
    return NextResponse.redirect(settingsUrl);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const claims = state ? verifyConnectStateToken(state, 'discord-connect') : null;
  if (!code || !claims) {
    settingsUrl.searchParams.set('discordError', 'expired');
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${url.origin}/api/auth/discord/callback`;
    const { access_token: accessToken } = await exchangeDiscordCode(code, redirectUri);
    const discordUser = await getDiscordUser(accessToken);

    const existing = await query(
      `SELECT user_id FROM platform_connections WHERE provider = 'discord' AND provider_user_id = $1`,
      [discordUser.id]
    );
    if (existing.rows[0] && existing.rows[0].user_id !== claims.userId) {
      settingsUrl.searchParams.set('discordError', 'taken');
      return NextResponse.redirect(settingsUrl);
    }

    await query(
      `INSERT INTO platform_connections (user_id, provider, provider_user_id, provider_username)
       VALUES ($1, 'discord', $2, $3)
       ON CONFLICT (user_id, provider) DO UPDATE
         SET provider_user_id = $2, provider_username = $3, connected_at = now()`,
      [claims.userId, discordUser.id, discordUser.username]
    );

    // Best-effort: grant the role immediately for any creator this fan is already
    // subscribed to (and has already joined the Discord server for), instead of
    // making them wait for their next billing event.
    await syncAllActiveSubscriptionsForFan(claims.userId);

    settingsUrl.searchParams.set('discordConnected', '1');
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error('Discord OAuth callback failed:', err);
    settingsUrl.searchParams.set('discordError', 'failed');
    return NextResponse.redirect(settingsUrl);
  }
}
