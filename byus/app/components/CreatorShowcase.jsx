import ArtSlot from './ArtSlot';

// "Show creators, not software." Six fictional demonstration creators, each a
// different craft, age, and background, so a visitor immediately sees ByUs isn't
// built for one type of creator. Visual direction (full-bleed photo, bottom-left
// name/quote overlay, a per-craft accent color on the CTA) follows a reference mockup
// the user supplied and liked specifically because the six people read as visibly
// different from each other -- this file recreates that as real, responsive
// components instead of the flattened reference image itself.
//
// Alex Rivers is the one profile with a real, live interactive page (the production
// /demo route) and real artwork already in /public/creators/alex-rivers. The other
// five are placeholders waiting on real artwork: each has a clearly named image slot
// below (ArtSlot with no `src` renders an honest "artwork placeholder" box, never a
// generated stand-in) at the exact path a finished hero.jpg should land at. None of
// these six are real ByUs members, and the disclaimer on every card is not
// negotiable copy -- it's what keeps this section from reading as a claim about real
// creators or real earnings.
const CREATORS = [
  {
    slug: 'alex-rivers',
    name: 'Alex Rivers',
    craft: 'Digital Artist',
    tagline: 'Fantasy worlds. Real emotions.',
    quote: 'Art is a way of seeing the world differently.',
    accent: 'teal',
    art: '/creators/alex-rivers/hero.jpg', // already supplied -- see also public/images/demo
    href: '/demo',
    cta: 'View Creator',
    live: true,
  },
  {
    slug: 'maya-sinclair',
    name: 'Maya Sinclair',
    craft: 'Photographer',
    tagline: 'Wild places. Honest moments.',
    quote: 'Teaching others to see the extraordinary in the everyday.',
    accent: 'olive',
    // BYUS ARTWORK SLOT: drop Maya Sinclair's hero photo at this path
    art: '/creators/maya-sinclair/hero.jpg',
  },
  {
    slug: 'liam-carter',
    name: 'Liam Carter',
    craft: 'Musician',
    tagline: 'Songs. Stories. Community.',
    quote: 'Music brings people together in a way nothing else can.',
    accent: 'rust',
    // BYUS ARTWORK SLOT: drop Liam Carter's hero photo at this path
    art: '/creators/liam-carter/hero.jpg',
  },
  {
    slug: 'elena-park',
    name: 'Elena Park',
    craft: 'Food Creator',
    tagline: 'Simple food. A happier you.',
    quote: 'Good food brings people together.',
    accent: 'clay',
    // BYUS ARTWORK SLOT: drop Elena Park's hero photo at this path
    art: '/creators/elena-park/hero.jpg',
  },
  {
    slug: 'sophie-lane',
    name: 'Sophie Lane',
    craft: 'Maker & Craft',
    tagline: 'Handmade for a slower world.',
    quote: 'Creating with my hands keeps me grounded.',
    accent: 'plum',
    // BYUS ARTWORK SLOT: drop Sophie Lane's hero photo at this path
    art: '/creators/sophie-lane/hero.jpg',
  },
  {
    slug: 'noah-blake',
    name: 'Noah Blake',
    craft: 'Fitness Creator',
    tagline: 'Stronger habits. A better you.',
    quote: "Progress isn't perfect. It's consistent.",
    accent: 'teal',
    // BYUS ARTWORK SLOT: drop Noah Blake's hero photo at this path
    art: '/creators/noah-blake/hero.jpg',
  },
];

// One accent per craft, echoing the reference's per-card CTA colors while staying
// inside ByUs's own restrained, muted palette (no neon, nothing outside what the
// brand's cream/paper/ink page already lives on). Reused rather than invented fresh
// per card: teal repeats for Alex and Noah on purpose -- six distinct crafts don't
// need six distinct hues to read as different people.
const ACCENTS = {
  teal: 'bg-brand-teal',
  olive: 'bg-[#5c6b4f]',
  rust: 'bg-[#a8532f]',
  clay: 'bg-brand-clay',
  plum: 'bg-[#6b3a4c]',
};

export default function CreatorShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="max-w-2xl">
        <span className="text-xs font-extrabold uppercase tracking-wide text-brand-clay">
          Demonstration creator pages
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#2B2420] sm:text-4xl">
          See what your page could look like
        </h2>
        <p className="mt-3 text-brand-ink/70">
          Six example profiles across different kinds of creative work — built to show the range of
          what&rsquo;s possible on ByUs, not real ByUs members or their actual earnings.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CREATORS.map((c) => (
          <CreatorCard key={c.slug} creator={c} />
        ))}
      </div>
    </section>
  );
}

function CreatorCard({ creator }) {
  const accentClass = ACCENTS[creator.accent] || ACCENTS.teal;

  return (
    <div className="group relative overflow-hidden rounded-sm border border-brand-ink/10 shadow-sm">
      <ArtSlot
        src={creator.art}
        alt={`${creator.name}, ${creator.craft.toLowerCase()} -- example ByUs creator page`}
        aspect="aspect-[4/5]"
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        label={`${creator.name} — artwork placeholder`}
        className="transition duration-300 group-hover:scale-[1.03]"
      />

      {/* Scrim so the overlay text stays readable regardless of what the photo
          looks like -- stronger at the bottom where the text sits, fading out by
          the upper third. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(0deg, rgba(10,12,10,0.82) 0%, rgba(10,12,10,0.35) 45%, transparent 72%)' }}
      />

      <div className="absolute inset-x-0 bottom-0 p-5">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand-gold">
          {creator.craft}
        </span>
        <h3 className="mt-1 font-display text-xl font-bold text-brand-paper">{creator.name}</h3>
        <p className="mt-1 text-sm font-medium text-brand-paper/90">{creator.tagline}</p>
        <p className="mt-2 text-sm italic leading-snug text-brand-paper/70">&ldquo;{creator.quote}&rdquo;</p>

        <div className="mt-4">
          {creator.live && creator.href ? (
            <a
              href={creator.href}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-brand-paper shadow-sm transition hover:opacity-90 ${accentClass}`}
            >
              {creator.cta || 'View Creator'} →
            </a>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-brand-paper opacity-80 ${accentClass}`}
              aria-disabled="true"
            >
              View Creator →
            </span>
          )}
        </div>

        <p className="mt-2.5 text-[11px] text-brand-paper/50">
          {creator.live ? 'Demonstration profile — interactive page shown is a live sandbox.' : 'Demonstration profile — interactive page coming soon.'}
        </p>
      </div>
    </div>
  );
}
