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

import { query } from './db';
import {
  isDiscordConfigured,
  addSubscriberRole,
  removeSubscriberRole,
} from './discord';
import {
  isTelegramConfigured,
  createSubscriberInviteLink,
  removeSubscriberFromChat,
  sendTelegramMessage,
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
