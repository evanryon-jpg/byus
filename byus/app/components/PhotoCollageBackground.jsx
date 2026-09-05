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
    // Capped width: the height classes below are tuned against a phone-width photo,
    // and a fixed height stretched across a full ultra-wide desktop window turns into
    // a much wider-than-tall crop window than the same banner on a phone -- object-cover
    // then has to zoom in further to fill that width, cropping away far more of the
    // photo's vertical extent (heads/hands can end up cropped out entirely). Capping the
    // width keeps the crop ratio close to what it looks like on a phone at every
    // breakpoint, instead of stretching thinner as the window gets wider.
    <div className="mx-auto max-w-4xl">
      <div className="relative h-40 w-full overflow-hidden sm:h-52 md:h-64" aria-hidden="true">
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
