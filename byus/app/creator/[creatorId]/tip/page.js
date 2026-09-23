// Retired: this used to be a standalone, share-anywhere "tip me" page — a content-free
// one-time payment with nothing described on the other side of it. Stripe's compliance
// review (Sept 2026) asked ByUs to tie tips to specific content instead of leaving them
// as an undescribed payment between two people. Tipping now happens per-post, from the
// "☕ Tip this post" button in each post's action row (see TipButton in ProfileClient.js)
// and requires a postId (see app/api/creators/[creatorId]/tip/route.js).
//
// This route is kept as a redirect rather than deleted outright, since a creator may
// already have this link out in a video description or stream panel — better to land
// them on the profile than 404 a link that's already circulating.

import { redirect } from 'next/navigation';

export default function TipPage({ params }) {
  redirect(`/creator/${params.creatorId}`);
}
