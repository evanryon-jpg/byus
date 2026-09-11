import Image from 'next/image';

// A single reusable image slot for creator artwork -- used on the homepage's creator
// showcase and, going forward, anywhere a real photo/illustration is the point of the
// section. `src` is either a real path under /public (already-supplied artwork) or
// null/undefined when nothing has been supplied yet. This is a plain prop rather than
// runtime <img onError> detection on purpose: we always know at author time which
// slots are filled, so the empty state renders identically on the server and never
// flashes a broken-image icon before JS loads.
//
// The empty state is deliberately plain -- a flat panel, a thin dashed border, and a
// small caption -- so it never reads as finished work standing in for real art. No
// gradient fill, no icon drawn to represent the subject, nothing that could be mistaken
// for actual creator content. Real artwork drops in later just by passing `src`; nothing
// else about the layout changes.
export default function ArtSlot({
  src,
  alt = '',
  aspect = 'aspect-[4/3]',
  className = '',
  sizes = '(min-width: 1024px) 33vw, 100vw',
  priority = false,
  label,
}) {
  return (
    <div className={`relative overflow-hidden rounded-sm bg-[#F5E9D8] ${aspect} ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed border-brand-ink/20 p-4 text-center">
          <PlaceholderGlyph />
          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-ink/35">
            {label || 'Artwork placeholder'}
          </span>
        </div>
      )}
    </div>
  );
}

// The universal "no image yet" convention (a picture frame with a torn corner) --
// not an illustration of the subject, just a UI affordance that reads as "nothing
// here yet" the way a wireframe or CMS empty-state would.
function PlaceholderGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-ink/25" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3 17l5-5 4 4 3-3 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
