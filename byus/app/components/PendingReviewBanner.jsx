'use client';

// Shown on the creator dashboard while ByUs's one-time initial review is still open
// (users.review_cleared_at is null) — every new creator starts here. Purely informational:
// there's nothing for the creator to do but keep building their page, so unlike
// VerifyEmailBanner/AcknowledgePolicyBanner this has no action button. An admin clears the
// review from /admin (see app/api/admin/users/[id]/clear-review/route.js); once cleared,
// this banner just stops rendering and any posts made while pending go public automatically.
export default function PendingReviewBanner() {
  return (
    <div className="mb-6 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 p-4 text-sm">
      <p className="font-semibold text-[#8a6b2f]">Your page is completing an initial review</p>
      <p className="mt-0.5 text-brand-ink/70">
        This is a one-time check we run on every new creator before their page can accept its
        first paying fan. Keep building — add tiers, links, and posts in the meantime — anything
        you publish now will go live automatically as soon as the review clears, usually within
        a day or two.
      </p>
    </div>
  );
}
