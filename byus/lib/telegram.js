// Telegram integration. Unlike Discord, a Telegram bot can't add someone to a group
// programmatically -- there's no "invite by user id" API -- so a fan joins the
// creator's private group themselves via a personal, single-use invite link the bot
// generates and DMs to them once they connect (see app/api/webhooks/telegram/route.js
// for the /start<token> deep-link handshake that makes that DM possible: a bot can only
// message a user who has messaged it first). Losing access works the opposite way --
// the bot removes them directly, which *is* something a bot can do to a group it admins.

import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

export function isTelegramConfigured() {
  return Boolean(BOT_TOKEN);
}

// Used to build the t.me/<username>?start=<token> deep link fans click to connect.
// Env-configurable rather than hardcoded so recreating the bot under a new username
// someday doesn't need a code change -- falls back to the bot actually created for
// this platform.
export function getTelegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || 'ByUsSubscribersBot';
}

// Telegram's setWebhook accepts a secret_token that it echoes back on every update as
// the X-Telegram-Bot-Api-Secret-Token header, so the webhook route can reject requests
// that didn't actually come from Telegram. Derived from JWT_SECRET (via HMAC, so the
// raw session secret is never reused directly) instead of a separate env var -- one
// less secret for Evan to generate and store by hand.
export function getTelegramWebhookSecret() {
  const base = process.env.JWT_SECRET;
  if (!base) throw new Error('JWT_SECRET is not set.');
  return crypto.createHmac('sha256', base).update('telegram-webhook').digest('hex').slice(0, 32);
}

async function callTelegram(method, body) {
  if (!TELEGRAM_API) throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram ${method} failed (${res.status}): ${data.description || 'unknown error'}`);
  }
  return data.result;
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options,
  });
}

// One-time, one-use invite link for a specific fan. member_limit: 1 means Telegram
// invalidates it itself after one join, so it can't be reused or forwarded to someone
// else. Expires in 24h if never used, so a fan who connects but doesn't click stays
// harmless rather than leaving a permanent open door into the group.
export async function createSubscriberInviteLink(chatId) {
  const result = await callTelegram('createChatInviteLink', {
    chat_id: chatId,
    member_limit: 1,
    expire_date: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    name: 'ByUs subscriber invite',
  });
  return result.invite_link;
}

// Removes a fan from the group without permanently banning them (ban immediately
// followed by unban with only_if_banned -- Telegram's documented pattern for "kick,
// don't ban"), so a fan who resubscribes later can rejoin on a fresh invite link.
export async function removeSubscriberFromChat(chatId, telegramUserId) {
  try {
    await callTelegram('banChatMember', { chat_id: chatId, user_id: telegramUserId });
  } catch (err) {
    // "user not found" / "PARTICIPANT_ID_INVALID" means they were never in the chat --
    // nothing to remove, not a real failure.
    if (!/not found|PARTICIPANT_ID_INVALID/i.test(err.message)) throw err;
    return false;
  }
  await callTelegram('unbanChatMember', { chat_id: chatId, user_id: telegramUserId, only_if_banned: true });
  return true;
}

export async function setTelegramWebhook(url) {
  return callTelegram('setWebhook', { url, secret_token: getTelegramWebhookSecret() });
}

// Read-only check of whether a user is CURRENTLY in the chat, straight from Telegram
// rather than trusting that an earlier invite/removal call actually landed. Used by the
// platform-access reconciliation cron (see lib/platform-sync.js) to catch drift from a
// grant/revoke that silently failed, since those calls are deliberately best-effort and
// never retried inline. Returns Telegram's own status string ('member', 'administrator',
// 'creator', 'restricted', 'left', 'kicked') so callers decide what counts as "has access"
// rather than this function guessing.
export async function getChatMemberStatus(chatId, telegramUserId) {
  try {
    const result = await callTelegram('getChatMember', { chat_id: chatId, user_id: telegramUserId });
    return result.status;
  } catch (err) {
    // "user not found" / "PARTICIPANT_ID_INVALID" means they were never in the chat (or
    // Telegram has already forgotten them after leaving/being removed) -- treat the same
    // as an explicit 'left', not a failure worth surfacing.
    if (/not found|PARTICIPANT_ID_INVALID/i.test(err.message)) return 'left';
    throw err;
  }
}
