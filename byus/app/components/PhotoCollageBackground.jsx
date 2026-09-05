import Image from 'next/image';

// A single real creator-at-work photo, sitting above the hero/header copy as a
// banner rather than tiled behind it -- a nod to Patreon's own homepage, which
// leads with people making things, without a busy grid competing with the text
// underneath for legibility or clashing with whatever sits next to it (like the
// profile-preview card on the homepage). Each page that uses this picks its own
// photo via `src` so scrolling between pages surfaces a different creator rather
// than repeating the same collage everywhere.
//
// Every photo is freely licensed (public domain or Creative Commons) via Wikimedia
// Commons; full credits live at /photo-credits, linked from the site footer.
//
// Purely decorative -- aria-hidden, and the <Image> gets an empty alt -- so it
// never competes with the page's real content for a screen reader.
export default function PhotoCollageBackground({ src, priority = true }) {
  return (
    // A fixed height per breakpoint (the original design here) means the crop window's
    // aspect ratio keeps getting wider as the viewport grows -- width scales with the
    // screen, height doesn't -- so object-cover has to zoom in further and further on a
    // wide desktop window than it does on a phone, cropping away far more of the photo's
    // vertical extent (heads/hands can end up cropped out entirely) even with a capped
    // max-width. Locking the box to a single aspect-ratio instead of a per-breakpoint
    // height means width and height always scale together, so the crop looks the same
    // shape at every screen size -- phone, tablet, or a full desktop monitor -- matching
    // whatever looked right on a phone, which is what this ratio is tuned against.
    <div className="mx-auto max-w-4xl">
      <div className="relative aspect-[12/5] w-full overflow-hidden" aria-hidden="true">
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 896px) 896px, 100vw"
          className="object-cover object-top"
          priority={priority}
        />
        {/* Fades the bottom edge into the page's paper background so the banner reads
            as a deliberate header, not a photo strip with a hard cut line under it. */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-brand-paper sm:h-14" />
      </div>
    </div>
  );
}
