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
// /demo route). All six now have real supplied photos under /public/creators/<slug>/
// -- if a future creator's photo isn't ready yet, leave its `art` field unset and
// ArtSlot renders an honest "artwork placeholder" box instead of a generated
// stand-in. None of these six are real ByUs members, and the disclaimer on every
// card is not negotiable copy -- it's what keeps this section from reading as a
// claim about real creators or real earnings.
const CREATORS = [
  {
    slug: 'alex-rivers',
    name: 'Alex Rivers',
    craft: 'Digital Artist',
    tagline: 'Fantasy worlds. Real emotions.',
    quote: 'Art is a way of seeing the world differently.',
    // Deliberately a different file from /creators/alex-rivers/hero.jpg -- that one
    // is his landscape painting, reused on the homepage hero as an example of his
    // artwork. This showcase card uses a photo of Alex himself, matching the other
    // five cards below.
    art: '/creators/alex-rivers/showcase.jpg',
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
    art: '/creators/maya-sinclair/hero.jpg',
    href: '/demo/maya-sinclair',
  },
  {
    slug: 'liam-carter',
    name: 'Liam Carter',
    craft: 'Musician',
    tagline: 'Songs. Stories. Community.',
    quote: 'Music brings people together in a way nothing else can.',
    art: '/creators/liam-carter/hero.jpg',
    href: '/demo/liam-carter',
  },
  {
    slug: 'elena-park',
    name: 'Elena Park',
    // Craft swapped from an earlier "Food Creator" placeholder once the real
    // supplied photo turned out to be an ASL educator instead -- copy below was
    // rewritten to match the photo rather than the other way around.
    craft: 'ASL Educator',
    tagline: 'Language. Connection. Community.',
    quote: 'Everyone deserves a way to be understood.',
    art: '/creators/elena-park/hero.jpg',
    href: '/demo/elena-park',
  },
  {
    slug: 'sophie-lane',
    name: 'Sophie Lane',
    craft: 'Maker & Craft',
    tagline: 'Handmade for a slower world.',
    quote: 'Creating with my hands keeps me grounded.',
    art: '/creators/sophie-lane/hero.jpg',
    href: '/demo/sophie-lane',
  },
  {
    slug: 'noah-blake',
    name: 'Noah Blake',
    craft: 'Fitness Creator',
    tagline: 'Stronger habits. A better you.',
    quote: "Progress isn't perfect. It's consistent.",
    art: '/creators/noah-blake/hero.jpg',
    href: '/demo/noah-blake',
  },
];

export default function CreatorShowcase() {
  return (
    <section id="creator-examples" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-10 sm:py-14">
      <div className="max-w-2xl">
        <span className="text-xs font-extrabold uppercase tracking-wide text-brand-clay">
          Demonstration creator pages
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#172033] sm:text-4xl">
          This could be your page.
        </h2>
        <p className="mt-3 text-brand-ink/70">
          Six example profiles across different kinds of creative work — built to show the range of
          what&rsquo;s possible on ByUs, not real ByUs members or their actual earnings.
        </p>
      </div>

      {/* Two-up on phones (previously one giant full-bleed card per row, which alone
          could run six screens of scroll) and a shorter near-square crop below the sm
          breakpoint -- the full 4:5 portrait crop comes back once there's room for it
          at sm+ and up to three per row. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 lg:grid-cols-3">
        {CREATORS.map((c) => (
          <CreatorCard key={c.slug} creator={c} />
        ))}
      </div>
    </section>
  );
}

function CreatorCard({ creator }) {
  return (
    <a
      href={creator.href}
      aria-label={`View ${creator.name}'s demonstration creator page`}
      className="group relative block overflow-hidden rounded-sm border border-brand-ink/10 shadow-sm outline-none transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:ring-4 focus-visible:ring-brand-gold/70"
    >
      <ArtSlot
        src={creator.art}
        alt={`${creator.name}, ${creator.craft.toLowerCase()} -- example ByUs creator page`}
        aspect="aspect-[1/1] sm:aspect-[4/5]"
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 50vw"
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

      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-brand-gold sm:text-[11px]">
          {creator.craft}
        </span>
        <h3 className="mt-1 font-display text-base font-bold text-brand-paper sm:text-xl">{creator.name}</h3>
        <p className="mt-0.5 text-xs font-medium text-brand-paper/90 sm:mt-1 sm:text-sm">{creator.tagline}</p>
        <p className="mt-2 hidden text-sm italic leading-snug text-brand-paper/70 sm:block">
          &ldquo;{creator.quote}&rdquo;
        </p>

        <div className="mt-2.5 sm:mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal px-3 py-1.5 text-xs font-semibold text-brand-paper shadow-sm transition group-hover:bg-[#115E59] sm:px-4 sm:py-2 sm:text-sm">
            {creator.cta || 'View Creator'} →
          </span>
        </div>

        <p className="mt-2.5 hidden text-[11px] text-brand-paper/50 sm:block">
          {/* Alex Rivers is the one profile with a real checkout simulation, tier
              joining, and confetti -- "live sandbox" oversells the other five, which
              are lighter preview pages (a view toggle and a "try this tier" button,
              no full purchase flow). Only the one where that's actually true gets the
              stronger claim; the rest get accurate, softer wording instead. */}
          {creator.live
            ? 'Demonstration profile — interactive page shown is a live sandbox.'
            : 'Demonstration profile — a quick preview, not the full interactive sandbox.'}
        </p>
      </div>
    </a>
  );
}
