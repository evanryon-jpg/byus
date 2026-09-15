export const dynamic = 'force-dynamic';

// PATCH /api/creator/integrations
// Lets a creator set (or clear) which Discord server/role and Telegram group ByUs
// should manage subscriber access for. Plain config, not an OAuth flow -- the creator
// adds the bots to their own server/group themselves first (see the setup guide) and
// pastes the resulting IDs in here.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

// Discord/Telegram IDs are always numeric strings (Discord snowflakes, Telegram chat
// ids -- the latter negative for groups/supergroups). Loosely validated so a pasted
// URL or role *name* instead of an ID fails fast with a clear message rather than
// silently saving something the bot will never match against.
function isPlausibleId(value) {
  return /^-?\d{5,25}$/.test(value);
}

export async function PATCH(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can manage integrations.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const fields = {
    discord_guild_id: body.discordGuildId,
    discord_subscriber_role_id: body.discordSubscriberRoleId,
    telegram_chat_id: body.telegramChatId,
  };

  for (const [column, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined && !isPlausibleId(String(value))) {
      return NextResponse.json(
        { error: `That doesn't look like a valid ID for ${column.replace(/_/g, ' ')}.` },
        { status: 400 }
      );
    }
  }

  await query(
    `UPDATE users SET discord_guild_id = $1, discord_subscriber_role_id = $2, telegram_chat_id = $3
     WHERE id = $4`,
    [fields.discord_guild_id || null, fields.discord_subscriber_role_id || null, fields.telegram_chat_id || null, session.userId]
  );

  return NextResponse.json({ ok: true });
}
