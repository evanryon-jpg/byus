import ArtSlot from './ArtSlot';

// What a ByUs page actually looks like, shown rather than described. Alex Rivers is
// the one profile here with real artwork and a real, live interactive page (the
// production /demo route) -- everything else is a clearly-labeled demonstration
// profile with an honest, unfilled artwork slot (see ArtSlot.jsx) standing in for
// professional art that hasn't been supplied yet. None of these eight are real ByUs
// members; nothing here is fetched from the database, and the disclaimer below is not
// negotiable copy -- it's what keeps this section from reading as a claim about real
// creators or real earnings.
const CREATORS = [
  {
    slug: 'alex-rivers',
    name: 'Alex Rivers',
    craft: 'Digital Artist & Animator',
    description:
      "Hand-drawn animation shorts and the process behind them — sketches, storyboards, and the pieces only members see.",
    tiers: [5, 12, 35],
    art: {
      hero: '/creators/alex-rivers/hero.jpg',
      avatar: '/creators/alex-rivers/avatar.jpg',
      public: '/creators/alex-rivers/world-sketch.jpg',
      locked: '/creators/alex-rivers/member-exclusive.jpg',
    },
    href: '/demo',
    cta: 'See the full interactive page',
    live: true,
  },
  {
    slug: 'maya-cortez',
    name: 'Maya Cortez',
    craft: 'Photographer',
    description: 'Editorial and travel photography, one roll of film at a time.',
    tiers: [6, 15],
  },
  {
    slug: 'theo-lindqvist',
    name: 'Theo Lindqvist',
    craft: 'Musician',
    description: 'Home-studio sessions, unreleased demos, and the gear that makes them.',
    tiers: [5, 10, 20],
  },
  {
    slug: 'priya-nakamura',
    name: 'Priya Nakamura',
    craft: 'Food Creator',
    description: 'Weeknight recipes, tested twice before they ever reach you.',
    tiers: [5, 12],
  },
  {
    slug: 'jasmine-holt',
    name: 'Jasmine Holt',
    craft: 'Ceramics & Craft',
    description: 'Hand-thrown ceramics and the glaze tests nobody else sees.',
    tiers: [5, 15],
  },
  {
    slug: 'marcus-reyes',
    name: 'Marcus Reyes',
    craft: 'Fitness Creator',
    description: "Strength programming for people who don't live at the gym.",
    tiers: [10, 25],
  },
  {
    slug: 'dev-okafor',
    name: 'Dev Okafor',
    craft: 'Gaming Creator',
    description: "Speedrun breakdowns and the runs that didn't make the highlight reel.",
    tiers: [5, 10],
  },
  {
    slug: 'lena-marchetti',
    name: 'Lena Marchetti',
    craft: 'Writer',
    description: 'Serial fiction, one chapter at a time, with the drafts that got cut.',
    tiers: [4, 9],
  },
];

export default function CreatorShowcase() {
  const [featured, ...rest] = CREATORS;

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
          Eight example profiles across different kinds of creative work — built to show the range of
          what&rsquo;s possible on ByUs, not real ByUs members or their actual earnings.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <FeaturedCreatorCard creator={featured} className="sm:col-span-2 lg:col-span-2" />
        {rest.map((c) => (
          <CompactCreatorCard key={c.slug} creator={c} />
        ))}
      </div>
    </section>
  );
}

function TierChips({ tiers }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Example membership tiers">
      {tiers.map((price) => (
        <span
          key={price}
          className="rounded-full border border-brand-ink/15 bg-brand-paper px-2.5 py-1 text-[11px] font-bold tabular-nums text-brand-ink/70"
        >
          ${price}/mo
        </span>
      ))}
    </div>
  );
}

function FeaturedCreatorCard({ creator, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-sm border border-brand-ink/10 bg-brand-paper ${className}`}>
      <div className="relative">
        {/* BYUS ARTWORK: Alex Rivers hero artwork */}
        <ArtSlot
          src={creator.art?.hero}
          alt={`Featured artwork from ${creator.name}`}
          aspect="aspect-[16/10]"
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, rgba(15,26,22,0.75) 0%, transparent 55%)' }}
        />
        <div className="absolute left-5 top-5 h-14 w-14 overflow-hidden rounded-xl border-2 border-brand-paper shadow-md">
          {/* BYUS ARTWORK: Alex Rivers avatar */}
          <ArtSlot src={creator.art?.avatar} alt={creator.name} aspect="aspect-square" label="Avatar" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-brand-paper">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand-gold">{creator.craft}</span>
          <h3 className="mt-1 font-display text-2xl font-bold">{creator.name}</h3>
        </div>
      </div>

      <div className="p-5">
        <p className="text-sm leading-relaxed text-brand-ink/70">{creator.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="relative">
            {/* BYUS ARTWORK: Alex Rivers process piece */}
            <ArtSlot src={creator.art?.public} alt={`A public post from ${creator.name}`} aspect="aspect-square" />
            <span className="absolute left-2 top-2 rounded bg-brand-ink/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-paper">
              Public
            </span>
          </div>
          <div className="relative">
            {/* BYUS ARTWORK: Alex Rivers locked member artwork */}
            <ArtSlot src={creator.art?.locked} alt="A members-only post" aspect="aspect-square" />
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-brand-ink/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-paper">
              <LockGlyph /> Members
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <TierChips tiers={creator.tiers} />
          {creator.live && creator.href && (
            <a
              href={creator.href}
              className="text-sm font-bold text-brand-teal underline-offset-2 hover:underline"
            >
              {creator.cta} →
            </a>
          )}
        </div>

        <p className="mt-4 text-[11px] text-brand-ink/40">
          Demonstration profile — not a real ByUs member. Interactive page shown is a live sandbox.
        </p>
      </div>
    </div>
  );
}

function CompactCreatorCard({ creator }) {
  return (
    <div className="overflow-hidden rounded-sm border border-brand-ink/10 bg-brand-paper">
      <div className="relative">
        <ArtSlot
          src={creator.art?.hero}
          alt={`Example artwork representing ${creator.craft.toLowerCase()}`}
          aspect="aspect-[4/5]"
          label="Artwork placeholder"
        />
        <div className="absolute left-3 top-3 h-10 w-10 overflow-hidden rounded-lg border-2 border-brand-paper shadow-sm">
          <ArtSlot src={creator.art?.avatar} alt={creator.name} aspect="aspect-square" label="" />
        </div>
      </div>
      <div className="p-4">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-brand-clay">{creator.craft}</span>
        <h3 className="mt-1 font-display text-base font-bold leading-tight text-[#2B2420]">{creator.name}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-brand-ink/65">{creator.description}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <TierChips tiers={creator.tiers} />
          <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-ink/40" title="Some posts are members-only">
            <LockGlyph />
          </span>
        </div>
        <p className="mt-3 text-[10.5px] text-brand-ink/35">Demonstration profile</p>
      </div>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
