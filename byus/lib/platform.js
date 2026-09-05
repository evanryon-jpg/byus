// ByUs doesn't have a separate "platform" Stripe account -- Evan's own creator account is
// the one Connect account behind the whole site today. /support (app/support/page.js) reuses
// the existing per-creator tip rail (see app/api/creators/[creatorId]/tip/route.js) pointed at
// this id, so "donate to ByUs" and "tip this creator" are the same payment underneath, just
// framed differently. If ByUs ever gets its own dedicated business Stripe account, this is the
// one place to repoint.
export const PLATFORM_CREATOR_ID = 'a03dd0fe-b353-47ea-ba33-dece6c21c8ce';
