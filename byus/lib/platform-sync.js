// Grants/revokes a fan's Discord role and Telegram group membership to match their
// subscription status. Called from two places: the Stripe webhook (see
// app/api/webhooks/stripe/route.js) whenever a subscription's active/canceled status
// changes, and right after a fan connects a new platform account (see
// app/api/auth/discord/callback/route.js and app/api/webhooks/telegram/route.js) in
// case they already had an active subscription before connecting.
//
// Every function here is best-effort: it logs and swallows its own errors rather than
// throwing, because a Discord/Telegram hiccup should never fail a payment webhook or
// block a fan from finishing checkout. Nothing here is the source of truth for access
// -- the `subscriptions` table is -- this is purely a side effect that keeps the bots
// in sync with it.
//
// Because these calls are best-effort and never retried inline, a transient failure --
// a rate limit, a brief Discord/Telegram outage, the bot temporarily missing permissions
// -- can silently leave a fan's actual bot access out of sync with their subscription,
// with nothing to notice or fix it: no future billing event re-triggers a sync for an
// already-active subscription, and a failed revoke on cancellation leaves paid-only
// access in place indefinitely. reconcilePlatformAccess() at the bottom of this file is
// the fix -- a daily sweep (see app/api/cron/reconcile-platform-access) that checks
// actual Discord/Telegram state against what each subscription says it should be and
// repairs any drift, so a one-time API hiccup is self-healing within a day instead of
// permanent.

import { query } from './db';
import { alertOps } from './alerts';
import {
  isDiscordConfigured,
  addSubscriberRole,
  removeSubscriberRole,
  getGuildMemberRoles,
} from './discord';
import {
  isTelegramConfigured,
  createSubscriberInviteLink,
  removeSubscriberFromChat,
  sendTelegramMessage,
  getChatMemberStatus,
} from './telegram';

async function getCreatorPlatformConfig(creatorId) {
  const result = await query(
    `SELECT discord_guild_id, discord_subscriber_role_id, telegram_chat_id
     FROM users WHERE id = $1`,
    [creatorId]
  );
  return result.rows[0] || null;
}

async function getFanConnection(fanId, provider) {
  const result = await query(
    `SELECT provider_user_id, provider_username FROM platform_connections
     WHERE user_id = $1 AND provider = $2`,
    [fanId, provider]
  );
  return result.rows[0] || null;
}

async function syncDiscordAccess({ fanId, creatorId, grant }) {
  if (!isDiscordConfigured()) return;
  try {
    const creator = await getCreatorPlatformConfig(creatorId);
    if (!creator?.discord_guild_id || !creator?.discord_subscriber_role_id) return;
    const connection = await getFanConnection(fanId, 'discord');
    if (!connection) return; // fan hasn't linked Discord -- nothing to sync

    const args = {
      guildId: creator.discord_guild_id,
      roleId: creator.discord_subscriber_role_id,
      discordUserId: connection.provider_user_id,
    };
    if (grant) {
      await addSubscriberRole(args);
    } else {
      await removeSubscriberRole(args);
    }
  } catch (err) {
    console.error(`Discord role sync failed (fan ${fanId}, creator ${creatorId}, grant=${grant}):`, err);
    // Not urgent enough to page for a single fan, but worth knowing about if it's
    // happening at all -- same throttled ops-email path the Stripe webhooks use, so a
    // systemic Discord failure (bad bot token, revoked permissions) surfaces within the
    // hour instead of only showing up as silent drift the next reconciliation run fixes.
    await alertOps('discord-role-sync', err);
  }
}

async function syncTelegramAccess({ fanId, creatorId, grant }) {
  if (!isTelegramConfigured()) return;
  try {
    const creator = await getCreatorPlatformConfig(creatorId);
    if (!creator?.telegram_chat_id) return;
    const connection = await getFanConnection(fanId, 'telegram');
    if (!connection) return; // fan hasn't linked Telegram -- nothing to sync

    if (grant) {
      const link = await createSubscriberInviteLink(creator.telegram_chat_id);
      await sendTelegramMessage(
        connection.provider_user_id,
        `You're in! Here's your private invite to the subscriber group -- this link works once, just for you:\n${link}`
      );
    } else {
      const removed = await removeSubscriberFromChat(creator.telegram_chat_id, connection.provider_user_id);
      if (removed) {
        await sendTelegramMessage(
          connection.provider_user_id,
          `Your subscription ended, so you've been removed from the private group. Resubscribe any time to get a fresh invite.`
        ).catch(() => {}); // best-effort notice, removal itself already succeeded either way
      }
    }
  } catch (err) {
    console.error(`Telegram sync failed (fan ${fanId}, creator ${creatorId}, grant=${grant}):`, err);
    await alertOps('telegram-sync', err);
  }
}

// Main entry point: called with grant=true when a subscription becomes active,
// grant=false when it stops being active (canceled, deleted, or lapsed).
export async function syncPlatformAccess({ fanId, creatorId, grant }) {
  await Promise.all([
    syncDiscordAccess({ fanId, creatorId, grant }),
    syncTelegramAccess({ fanId, creatorId, grant }),
  ]);
}

// Called right after a fan connects a new platform account, in case they already had
// an active subscription (or several) before connecting -- otherwise they'd have to
// wait for their next billing event to actually get access.
export async function syncAllActiveSubscriptionsForFan(fanId) {
  try {
    const result = await query(
      `SELECT creator_id FROM subscriptions WHERE fan_id = $1 AND status = 'active'`,
      [fanId]
    );
    await Promise.all(
      result.rows.map((row) => syncPlatformAccess({ fanId, creatorId: row.creator_id, grant: true }))
    );
  } catch (err) {
    console.error(`Failed to sync existing subscriptions for fan ${fanId} after platform connect:`, err);
  }
}

// Called right before a fan disconnects a platform account (see
// app/api/fan/connections/[provider]/route.js) -- must run while the
// platform_connections row still exists, since that's where the Discord/Telegram user
// id to revoke comes from. Scoped to just the one provider being disconnected, unlike
// syncPlatformAccess which always does both.
export async function revokeProviderAccessForFan(fanId, provider) {
  try {
    const result = await query(
      `SELECT creator_id FROM subscriptions WHERE fan_id = $1 AND status = 'active'`,
      [fanId]
    );
    const sync = provider === 'discord' ? syncDiscordAccess : syncTelegramAccess;
    await Promise.all(result.rows.map((row) => sync({ fanId, creatorId: row.creator_id, grant: false })));
  } catch (err) {
    console.error(`Failed to revoke ${provider} access for fan ${fanId} before disconnect:`, err);
  }
}

// ---- Reconciliation -------------------------------------------------------------------
//
// Daily drift check (see app/api/cron/reconcile-platform-access), catching whatever the
// best-effort grant/revoke calls above silently missed. Scope is deliberately narrow:
// only (fan, creator) pairs where the fan has actually linked that provider AND the
// creator has it configured -- there's nothing to reconcile otherwise. "Should have
// access" is computed fresh from the subscriptions table (true if ANY row for that
// fan/creator pair is currently 'active'), not read off whichever row the query happens
// to return, since a fan can have multiple historical rows (re-subscribes) that would
// otherwise give a stale answer.

async function getDiscordReconciliationPairs() {
  const result = await query(
    `SELECT DISTINCT
       s.fan_id, s.creator_id, pc.provider_user_id AS discord_user_id,
       u.discord_guild_id, u.discord_subscriber_role_id,
       EXISTS (
         SELECT 1 FROM subscriptions s2
         WHERE s2.fan_id = s.fan_id AND s2.creator_id = s.creator_id AND s2.status = 'active'
       ) AS should_have_access
     FROM subscriptions s
     JOIN platform_connections pc ON pc.user_id = s.fan_id AND pc.provider = 'discord'
     JOIN users u ON u.id = s.creator_id
     WHERE u.discord_guild_id IS NOT NULL AND u.discord_subscriber_role_id IS NOT NULL`
  );
  return result.rows;
}

async function getTelegramReconciliationPairs() {
  const result = await query(
    `SELECT DISTINCT
       s.fan_id, s.creator_id, pc.provider_user_id AS telegram_user_id,
       u.telegram_chat_id,
       EXISTS (
         SELECT 1 FROM subscriptions s2
         WHERE s2.fan_id = s.fan_id AND s2.creator_id = s.creator_id AND s2.status = 'active'
       ) AS should_have_access
     FROM subscriptions s
     JOIN platform_connections pc ON pc.user_id = s.fan_id AND pc.provider = 'telegram'
     JOIN users u ON u.id = s.creator_id
     WHERE u.telegram_chat_id IS NOT NULL`
  );
  return result.rows;
}

// Telegram statuses that count as "currently has access." 'restricted' still means
// they're in the chat, just with limited permissions -- treated as present either way.
const TELEGRAM_PRESENT_STATUSES = new Set(['member', 'administrator', 'creator', 'restricted']);

async function reconcileDiscordPair(pair, counts) {
  const {
    fan_id: fanId,
    creator_id: creatorId,
    discord_user_id: discordUserId,
    discord_guild_id: guildId,
    discord_subscriber_role_id: roleId,
    should_have_access: shouldHave,
  } = pair;
  try {
    const roles = await getGuildMemberRoles({ guildId, discordUserId });
    const actuallyHas = Boolean(roles && roles.includes(roleId));
    if (shouldHave && !actuallyHas) {
      await addSubscriberRole({ guildId, roleId, discordUserId });
      counts.discordGranted += 1;
    } else if (!shouldHave && actuallyHas) {
      await removeSubscriberRole({ guildId, roleId, discordUserId });
      counts.discordRevoked += 1;
    }
  } catch (err) {
    console.error(`Discord reconciliation failed (fan ${fanId}, creator ${creatorId}):`, err);
    counts.errors.push(err);
  }
}

async function reconcileTelegramPair(pair, counts) {
  const {
    fan_id: fanId,
    creator_id: creatorId,
    telegram_user_id: telegramUserId,
    telegram_chat_id: chatId,
    should_have_access: shouldHave,
  } = pair;
  try {
    const status = await getChatMemberStatus(chatId, telegramUserId);
    const actuallyPresent = TELEGRAM_PRESENT_STATUSES.has(status);
    if (shouldHave && !actuallyPresent) {
      const link = await createSubscriberInviteLink(chatId);
      await sendTelegramMessage(
        telegramUserId,
        `Reconnected you to the subscriber group — here's a fresh invite, just for you:\n${link}`
      );
      counts.telegramGranted += 1;
    } else if (!shouldHave && status === 'member') {
      // Only ever auto-remove a plain 'member' -- never an 'administrator'/'creator',
      // in case a group admin or the creator themselves happens to match a pair here.
      const removed = await removeSubscriberFromChat(chatId, telegramUserId);
      if (removed) {
        await sendTelegramMessage(
          telegramUserId,
          `Your subscription ended, so you've been removed from the private group. Resubscribe any time to get a fresh invite.`
        ).catch(() => {});
      }
      counts.telegramRevoked += 1;
    }
  } catch (err) {
    console.error(`Telegram reconciliation failed (fan ${fanId}, creator ${creatorId}):`, err);
    counts.errors.push(err);
  }
}

// Small batches, run sequentially, rather than one giant Promise.all across every pair --
// early-stage ByUs has few enough linked fans that this finishes in seconds either way,
// but staying gentle on Discord/Telegram's own rate limits now means it doesn't need
// revisiting as the platform grows.
async function runInBatches(items, worker, batchSize = 5) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(worker));
  }
}

// Entry point for the daily cron (app/api/cron/reconcile-platform-access). Checks actual
// Discord/Telegram state against what each linked fan's subscriptions say it should be,
// repairs any drift, and sends one throttled ops alert if anything failed outright rather
// than one per broken pair.
export async function reconcilePlatformAccess() {
  const counts = {
    discordChecked: 0,
    discordGranted: 0,
    discordRevoked: 0,
    telegramChecked: 0,
    telegramGranted: 0,
    telegramRevoked: 0,
    errors: [],
  };

  if (isDiscordConfigured()) {
    const pairs = await getDiscordReconciliationPairs();
    counts.discordChecked = pairs.length;
    await runInBatches(pairs, (pair) => reconcileDiscordPair(pair, counts));
  }

  if (isTelegramConfigured()) {
    const pairs = await getTelegramReconciliationPairs();
    counts.telegramChecked = pairs.length;
    await runInBatches(pairs, (pair) => reconcileTelegramPair(pair, counts));
  }

  if (counts.errors.length > 0) {
    await alertOps(
      'platform-access-reconciliation',
      new Error(`${counts.errors.length} pair(s) failed to reconcile. First error: ${counts.errors[0]?.message}`)
    );
  }

  const { errors, ...summary } = counts;
  return { ...summary, errorCount: errors.length };
}
