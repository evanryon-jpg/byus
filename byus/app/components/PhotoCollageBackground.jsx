import Image from 'next/image';

// A tiled wall of real creators-at-work photos behind a warm paper-toned scrim --
// softens the site's card-heavy look with something closer to Patreon's own
// homepage, which leads with people making things rather than another box. Every
// photo here is freely licensed (public domain or Creative Commons) via Wikimedia
// Commons; full credits live at /photo-credits, linked from the site footer.
//
// Purely decorative -- aria-hidden, and every <Image> gets an empty alt -- so it
// never competes with the page's real content for a screen reader.
export const COLLAGE_PHOTOS = [
  { src: '/images/collage/pottery.jpg' },
  { src: '/images/collage/musician.jpg' },
  { src: '/images/collage/painting.jpg' },
  { src: '/images/collage/sign-language.jpg' },
  { src: '/images/collage/woodworking.jpg' },
  { src: '/images/collage/baking.jpg' },
];

// Repeated (in a shuffled order, not a straight duplicate run) to fill a denser
// grid on wide screens without needing a dozen source photos -- the overlay sits
// on top of every tile, so a repeat reads as "a wall of creators," not as an
// obviously looping pattern.
const TILES = [
  ...COLLAGE_PHOTOS,
  COLLAGE_PHOTOS[3],
  COLLAGE_PHOTOS[0],
  COLLAGE_PHOTOS[5],
  COLLAGE_PHOTOS[1],
  COLLAGE_PHOTOS[4],
  COLLAGE_PHOTOS[2],
];

export default function PhotoCollageBackground({ overlayClassName }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-[3px] sm:grid-cols-4 md:grid-cols-6">
        {TILES.map((photo, i) => (
          <div key={i} className="relative">
            <Image
              src={photo.src}
              alt=""
              fill
              sizes="(min-width: 768px) 17vw, 34vw"
              className="object-cover"
              priority={i < 4}
            />
          </div>
        ))}
      </div>
      {/* Warm paper-toned scrim -- keeps the photos recognizable as photos while
          giving the ink-colored copy on top the contrast it needs. Heavier at the
          edges than dead center, echoing the vignette Patreon uses on its own hero. */}
      <div
        className={
          overlayClassName ||
          'absolute inset-0 bg-gradient-to-b from-brand-paper/92 via-brand-paper/80 to-brand-paper/94'
        }
      />
    </div>
  );
}
