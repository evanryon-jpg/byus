export const dynamic = 'force-dynamic';

// Telegram bot webhook. Handles two things:
//
// 1. `/start <token>` -- the deep-link a fan lands on after clicking "Connect
//    Telegram" in their ByUs dashboard (see app/api/fan/connections/telegram/route.js,
//    which mints the token). Links this Telegram account to their ByUs account, then
//    immediately grants access to any creator they're already subscribed to.
// 2. `/id` sent inside a group/supergroup -- lets a creator who just added the bot to
//    their private Telegram group discover that group's chat id, to paste into their
//    ByUs creator settings. No further gate on who can run it: it only ever reveals
//    the group's own id back into the group itself, which anyone already in the group
//    can already see is where they are.
//
// Registered via /api/admin/telegram/setup-webhook, which also sets the secret_token
// checked below.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getTelegramWebhookSecret, sendTelegramMessage } from '@/lib/telegram';
import { syncAllActiveSubscriptionsForFan } from '@/lib/platform-sync';

async function handleStart(message, token) {
  const chatId = message.chat.id;

  if (!token) {
    await sendTelegramMessage(
      chatId,
      "Hi! To connect your ByUs account, use the \"Connect Telegram\" button in your ByUs dashboard settings rather than starting this chat directly -- that gives you a personal link that connects the right account."
    );
    return;
  }

  const tokenResult = await query(
    `SELECT user_id, expires_at, consumed_at FROM telegram_link_tokens WHERE token = $1`,
    [token]
  );
  const row = tokenResult.rows[0];
  if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) {
    await sendTelegramMessage(
      chatId,
      "That connect link has expired or was already used. Head back to your ByUs dashboard settings and click \"Connect Telegram\" again for a fresh one."
    );
    return;
  }

  const telegramUserId = String(message.from.id);
  const telegramUsername = message.from.username || message.from.first_name || null;

  // Refuse if this Telegram account is already linked to a *different* ByUs account --
  // the platform_connections UNIQUE(provider, provider_user_id) constraint enforces
  // this too, but checking first lets us give a clear message instead of a raw
  // constraint-violation error.
  const existing = await query(
    `SELECT user_id FROM platform_connections WHERE provider = 'telegram' AND provider_user_id = $1`,
    [telegramUserId]
  );
  if (existing.rows[0] && existing.rows[0].user_id !== row.user_id) {
    await sendTelegramMessage(
      chatId,
      "This Telegram account is already connected to a different ByUs account. Disconnect it there first if you want to link it here instead."
    );
    return;
  }

  await query(
    `INSERT INTO platform_connections (user_id, provider, provider_user_id, provider_username)
     VALUES ($1, 'telegram', $2, $3)
     ON CONFLICT (user_id, provider) DO UPDATE
       SET provider_user_id = $2, provider_username = $3, connected_at = now()`,
    [row.user_id, telegramUserId, telegramUsername]
  );
  await query(`UPDATE telegram_link_tokens SET consumed_at = now() WHERE token = $1`, [token]);

  await sendTelegramMessage(
    chatId,
    "You're connected! If you're already subscribed to a creator with a private Telegram group, your invite link is on its way now."
  );

  // Best-effort: if the fan already has active subscriptions, grant Telegram access
  // right away instead of making them wait for their next billing event.
  await syncAllActiveSubscriptionsForFan(row.user_id);
}

async function handleId(message) {
  if (message.chat.type !== 'group' && message.chat.type !== 'supergroup') return;
  await sendTelegramMessage(
    message.chat.id,
    `This group's chat ID is:\n<code>${message.chat.id}</code>\n\nPaste that into your ByUs creator settings under "Telegram group."`
  );
}

export async function POST(request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== getTelegramWebhookSecret()) {
    return NextResponse.json({ error: 'Invalid secret token.' }, { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // malformed body -- nothing to do, don't let Telegram retry forever
  }

  // Always resolve 200: Telegram retries aggressively on non-2xx, and a bug in message
  // handling shouldn't turn into a retry storm against this endpoint.
  try {
    const message = update.message;
    if (message?.text) {
      if (message.text === '/start' || message.text.startsWith('/start ')) {
        const token = message.text.slice(6).trim() || null;
        await handleStart(message, token);
      } else if (message.text.trim() === '/id') {
        await handleId(message);
      }
    }
  } catch (err) {
    console.error('Telegram webhook handling failed:', err);
  }

  return NextResponse.json({ ok: true });
}
