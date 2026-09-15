export const dynamic = 'force-dynamic';

// GET /api/auth/discord/start
// Entry point for the "Connect Discord" button on the fan dashboard. Just redirects
// into Discord's OAuth consent screen; app/api/auth/discord/callback/route.js handles
// what comes back.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { createConnectStateToken } from '@/lib/auth';
import { buildDiscordAuthorizeUrl, isDiscordConfigured } from '@/lib/discord';

export async function GET(request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.redirect(new URL('/login?next=/settings', request.url));
  }
  if (!isDiscordConfigured()) {
    return NextResponse.redirect(new URL('/settings?discordError=unavailable', request.url));
  }

  const origin = request.headers.get('origin') || process.env.APP_URL;
  const redirectUri = `${origin}/api/auth/discord/callback`;
  const state = createConnectStateToken(session.userId, 'discord-connect');

  return NextResponse.redirect(buildDiscordAuthorizeUrl(redirectUri, state));
}
