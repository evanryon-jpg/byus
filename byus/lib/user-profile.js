// Shared "load the current user, enriched" logic. Originally lived only inside
// app/api/me/route.js; pulled out here so the settings page's server-side initial
// load (app/settings/page.js) can produce the exact same shape without a second,
// silently-drifting copy of the fee/avatar-url enrichment rules.

import { query } from '@/lib/db';
import {
  getPlatformMilestoneReductionPoints,
  applyPlatformMilestoneReduction,
  getFoundingCreatorRank,
} from '@/lib/fees';
import { FOUNDING_CREATOR_LIMIT, DISCOUNTED_FEE_PERCENT } from '@/lib/pricing';
import { isAdmin } from '@/lib/admin';
import { publicAvatarUrl, publicCoverUrl } from '@/lib/avatar-url';

// phone itself is deliberately left out of this shared select -- the client never
// needs the full number once it's verified (see PhoneNotificationsCard in
// app/settings/SettingsClient.js, which only ever shows the last 4 digits), so there's
// no reason to ship it to the browser at all. phone_last4/phone_verified are computed
// here instead of being real columns.
export const USER_SELECT_FIELDS = `id, email, role, display_name, bio, profile_image_url,
       stripe_connect_onboarded, content_policy_accepted_at, review_cleared_at, tags,
       email_verified, platform_fee_percent, notify_new_posts,
       show_support_publicly, support_goal_cents, zero_fee_promo_expires_at,
       discord_guild_id, discord_subscriber_role_id, telegram_chat_id,
       rss_feed_url, rss_last_synced_at, rss_last_sync_error,
       (phone_verified_at IS NOT NULL) AS phone_verified,
       CASE WHEN phone_verified_at IS NOT NULL THEN right(phone, 4) ELSE NULL END AS phone_last4,
       notify_new_posts_sms, cover_image_url, pinned_post_id`;

// profile_image_url in the DB is a private Blob pathname (or a `preset:<id>`
// marker), never exposed directly — point the client at our own public proxy
// route instead, versioned so switching photos actually changes the URL
// (see lib/avatar-url.js).
export function withAvatarUrl(user) {
  return {
    ...user,
    profile_image_url: publicAvatarUrl(user.id, user.profile_image_url),
    cover_image_url: publicCoverUrl(user.id, user.cover_image_url),
  };
}

// Adds the fee this user is actually being charged right now: their personal tier minus
// whatever platform-wide milestone bonus is currently in effect (see lib/fees.js) — the
// dashboard shows this, not the raw platform_fee_percent column, so a creator's "you keep
// X%" preview always matches what Stripe is really billing.
//
// Founding creators (see lib/fees.js) are pinned to DISCOUNTED_FEE_PERCENT here even
// before their stored platform_fee_percent column has caught up -- that column only
// updates on their first invoice (see recordEarningAndCheckFeeTier), but a founding
// creator should see their promo rate on day one, before they've ever billed anyone.
//
// Same reasoning applies to the creator-referral 0%-fee promo (lib/referrals.js,
// rewardCreatorReferrerLaunch): `zero_fee_promo_expires_at` is stamped on the referrer's
// row the instant their referred creator launches, but `platform_fee_percent` itself
// only catches up to 0% on the referrer's own NEXT invoice. Without this check here, a
// referrer who hasn't billed anyone since earning the reward would see their old
// (founding or standard) rate on their dashboard despite already having earned 0% --
// checking the expiry live means it shows up the moment it's granted, same as founding
// status does, with zero extra round trip since the column is already on `user`.
export async function withEffectiveFee(user) {
  if (user.role !== 'creator') return user;

  const [reductionPoints, foundingRank] = await Promise.all([
    getPlatformMilestoneReductionPoints(query),
    getFoundingCreatorRank(query, user.id),
  ]);
  const isFounding = foundingRank !== null && foundingRank <= FOUNDING_CREATOR_LIMIT;
  const zeroFeePromoActive =
    Boolean(user.zero_fee_promo_expires_at) && new Date(user.zero_fee_promo_expires_at) > new Date();

  return {
    ...user,
    is_founding_creator: isFounding,
    founding_creator_rank: isFounding ? foundingRank : null,
    zero_fee_promo_active: zeroFeePromoActive,
    effective_fee_percent: zeroFeePromoActive
      ? 0
      : isFounding
      ? DISCOUNTED_FEE_PERCENT
      : applyPlatformMilestoneReduction(user.platform_fee_percent, reductionPoints),
  };
}

// Same shape GET /api/me returns: { user: {...} } minus the wrapper. Returns null if the
// row is missing (shouldn't happen for a session that just passed getCurrentUser(), but
// callers should treat it defensively same as the API route always has).
export async function loadEnrichedUser(session) {
  const result = await query(`SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = $1`, [session.userId]);
  const user = result.rows[0];
  if (!user) return null;

  const enriched = await withEffectiveFee(withAvatarUrl(user));
  return { ...enriched, is_admin: isAdmin(session) };
}
