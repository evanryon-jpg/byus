// Compact "founding number" chip for dense list rows (FeaturedCreators.jsx on the
// homepage, and app/browse/page.js) -- a smaller sibling of the full foil tag on a
// creator's own profile page (app/creator/[creatorId]/ProfileClient.js). Pulled into
// one shared component instead of two hand-copied <span> blocks so the two lists can
// never quietly drift apart in style again. Both call sites already get `rank`/`limit`
// straight from /api/creators (see app/api/creators/route.js's founding_creator_rank
// subquery), which uses the exact same tie-break order as getFoundingCreatorRank
// (lib/fees.js) -- so this number always matches the one on the profile page itself.
export default function FoundingBadge({ rank, limit }) {
  if (rank == null) return null;

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#9C7C3E]/50 px-1.5 py-0.5 shadow-[0_2px_5px_-2px_rgba(156,124,62,0.55)]"
      style={{ background: 'linear-gradient(100deg, #f4e6c1, #C9A961 35%, #b6903f 65%, #E4CE95)' }}
      aria-label={`Founding creator, spot ${rank}${limit ? ` of ${limit}` : ''}`}
    >
      <span aria-hidden="true" className="font-display text-[10px] font-extrabold tabular-nums text-[#4a3708]">
        {String(rank).padStart(2, '0')}
      </span>
      <span aria-hidden="true" className="text-[8px] font-extrabold uppercase tracking-wide text-[#4a3708]">
        Founding
      </span>
    </span>
  );
}
