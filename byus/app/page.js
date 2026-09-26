import Image from 'next/image';
import { getCurrentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { getFoundingPromoStats } from '@/lib/fees';
import FAQSection from './components/FAQSection';
import { FAQS } from './components/faqs-data';
import EarningsCalculator from './components/EarningsCalculator';
import FeedbackWidget from './components/FeedbackWidget';
import LiveActivityTicker from './components/LiveActivityTicker';
import CreatorWalkthrough from './components/CreatorWalkthrough';
import HeroFilm from './components/HeroFilm';

// Server component so the hero and closing CTAs can tell whether someone is already
// logged in -- an existing creator or fan should never be invited to sign up again,
// they should be pointed straight back to the page they actually want.
// FAQPage structured data for search engines -- built from the exact same FAQS array
// FAQSection.jsx renders, so this can never say something the visible accordion
// doesn't. (The accordion itself keeps every answer mounted in the DOM at once now --
// see FAQSection.jsx -- but this script tag remains the authoritative machine-readable
// copy Google reads, independent of which item a visitor has open.)
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

export default async function HomePage() {
  const [session, foundingStats] = await Promise.all([
    getCurrentUser(),
    getFoundingPromoStats(query),
  ]);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FeedbackWidget />
      <LiveActivityTicker />
      <Hero user={session} stats={foundingStats} />
      <CreatorWalkthrough />
      <EarningsCalculator />
      <Features />
      <FoundingCreatorProgram stats={foundingStats} />
      <HowItWorks />
      <FAQSection />
      <WhyWeBuiltByUs user={session} />
      {/* PlatformGoalGauge (app/components/PlatformGoalGauge.jsx) pulled for now -- with
          one creator and no revenue yet, "our best month so far: $0.00" reads as a red
          flag to a visitor rather than a growth story. Bring it back once there's an
          actual best month worth showing. */}
    </div>
  );
}

// The Founding Creator Program, merged into one premium section (previously two --
// FoundingPromoBanner's fee-framing banner and FoundersCircleSection's two perk cards
// -- which repeated the same "founding creators keep more, sooner" point twice back to
// back). `stats` comes straight from lib/fees.js's getFoundingPromoStats(), which
// counts permanent founding reservations, including claimed creator accounts --
// `stats.limit`/`stats.remaining`/`stats.claimed` are never hardcoded, so this section
// can't drift from what a creator actually gets when they sign up. The literal "100
// SPOTS. 10% FOREVER." framing from the brief is built from `stats.limit` rather than a
// bare "100" so the copy stays correct if FOUNDING_CREATOR_LIMIT in lib/pricing.js ever
// changes; "10%" is left as a literal since it mirrors that same file's permanent
// MIN_FEE_PERCENT/DISCOUNTED_FEE_PERCENT constant. Every claim below is scoped to what's
// actually live: the fee is a permanent 10% (never "0%" or "keep 100%"), priority
// placement is real (see the is_founding ordering in /api/creators), and there's no
// human-curation layer, brand-deal matching, or other feature ByUs doesn't have --
// none of that is implied here.
//
// Styled as its own dark, premium panel rather than blending into the cream page
// background, so "Founding Creator Program" reads as a distinct, limited offer rather
// than another feature bullet -- the treatment the brief asked for when it said this
// needed to be "more visible."
//
// Creator signup is paused. Waitlist entries reserve available founding spots.
function FoundingCreatorProgram({ stats }) {
  const soldOut = stats.remaining <= 0;
  const perks = [
    {
      icon: <RankIcon />,
      title: 'Priority placement',
      body: `Automatically sorted first in Browse Creators when your page is live — before things get crowded.`,
    },
    {
      icon: <KeyIcon />,
      title: 'No follower minimum',
      body: `Zero followers required. Set up tiers, publish posts, and get paid directly — no algorithm gatekeeping who gets to monetize.`,
    },
    {
      icon: <FastForwardIcon />,
      title: 'Lowest rate from day one',
      body: `Founding creators lock in a 10% all-in platform fee from the beginning — and keep it for good.`,
    },
  ];

  return (
    <section id="founding" className="relative overflow-hidden bg-[#172554]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.10), transparent 65%)' }}
      />

      <div className="relative mx-auto max-w-5xl px-6 py-14 text-center">
        <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-gold">
          Founding Creator Program
        </span>
        <p className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold leading-tight text-brand-paper sm:text-5xl">
          {stats.limit} spots. <span className="text-brand-gold">10% forever.</span>
        </p>
        <p className="mx-auto mt-4 max-w-lg text-brand-paper/70">
          The first {stats.limit} founding spots lock in our lowest fee for good.
          No follower minimum or earnings requirement. For creators in the US.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-brand-paper/55">
          After the founding spots, creators start at 13% and move to 10% for the rest of
          any calendar month in which they reach $2,000 in gross ByUs earnings.
        </p>
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
          {perks.map((p) => (
            <div key={p.title} className="rounded-xl border border-brand-paper/15 bg-brand-paper/5 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-gold">
                {p.icon}
              </div>
              <h3 className="mt-3 font-display text-base font-bold text-brand-paper">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-paper/65">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          {soldOut ? (
            <p className="text-sm font-semibold text-brand-paper/70">
              All {stats.limit} founding spots are reserved. New waitlist entries receive standard pricing. Existing reservations keep their founding rate.
            </p>
          ) : (
            <>
              <FoundingSpotsGrid claimed={stats.claimed} limit={stats.limit} remaining={stats.remaining} />
              <a
                href="/signup?role=creator"
                className="mt-6 inline-block rounded-full bg-brand-gold px-8 py-3.5 text-base font-bold text-[#172554] shadow-[0_16px_30px_-14px_rgba(15,118,110,0.5)] transition hover:-translate-y-0.5"
              >
                Reserve your founding spot →
              </a>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-brand-paper/85">
                Founding spots are open now for US creators. Reserving one locks in the 10% rate for good, and creator
                accounts open soon: we&rsquo;ll email you a link, and you sign up with the same email to claim your spot.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// A depleting 10-column dot grid visualizing the Founding Creator Program's fixed 50-spot
// cap -- one dot per spot, lit gold once claimed. Deliberately literal rather than an
// abstract percentage bar: "50 spots" is a real, countable thing (FOUNDING_CREATOR_LIMIT
// in lib/pricing.js), driven by the same stats.claimed/stats.limit that already come
// straight from the reservation count in getFoundingPromoStats() (lib/fees.js) -- so this
// can't drift from what a creator actually gets. Assumes a grid-legible spot count
// (roughly <=100): if FOUNDING_CREATOR_LIMIT is ever raised well past that, this should
// become a scaled/grouped visualization instead of one <span> per spot.
function FoundingSpotsGrid({ claimed, limit, remaining }) {
  const dots = Array.from({ length: limit }, (_, i) => i < claimed);

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
      <div
        className="grid w-full grid-cols-10 gap-1.5"
        role="img"
        aria-label={`${claimed} of ${limit} founding spots reserved or claimed, ${remaining} remaining`}
      >
        {dots.map((filled, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={
              filled
                ? 'aspect-square w-full rounded-full bg-brand-gold shadow-[0_0_0_3px_rgba(201,169,97,0.15)]'
                : 'aspect-square w-full rounded-full border border-brand-paper/20 bg-brand-paper/10'
            }
          />
        ))}
      </div>
      <p className="text-sm text-brand-paper/70">
        <strong className="font-display text-base font-bold text-brand-paper">
          {remaining.toLocaleString()}
        </strong>{' '}
        founding {remaining === 1 ? 'spot remains' : 'spots remain'}
      </p>
    </div>
  );
}

function Hero({ user, stats }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    <section className="relative isolate overflow-hidden bg-[#08182d]">
      <div className="absolute inset-0 bg-[linear-gradient(112deg,#08172d_0%,#0b2037_48%,#0a4b55_100%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-48 h-[640px] w-[640px] rounded-full blur-3xl motion-safe:animate-byus-drift"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.22), transparent 66%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-52 top-[32%] h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(30,64,175,0.18), transparent 68%)' }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%22.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%22.7%22/%3E%3C/svg%3E')]" />

      <div className="relative mx-auto max-w-[1280px] px-6 pb-16 pt-16 sm:pb-20 sm:pt-20 lg:px-10 lg:pb-24 lg:pt-24">
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 xl:gap-16">
          <div className="relative z-10 max-w-2xl text-left">
            <span className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-[#58d4c3] sm:text-xs">
              <span className="h-px w-8 bg-[#58d4c3]/80" aria-hidden="true" />
              {stats.limit} founding creator spots
            </span>

            <h1 className="mt-7 max-w-[650px] font-display text-[2.9rem] font-medium leading-[1.02] tracking-[-0.045em] text-[#fffdf8] sm:text-[4.25rem] sm:leading-[0.98] lg:text-[4rem] xl:text-[4.25rem]">
              The home your fans keep coming back to.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-[#dce8eb]/85 sm:text-xl">
              Memberships, tips, video, downloads, and community access — together on one creator page.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              {user ? (
                <a
                  href={dashboardHref}
                  className="inline-flex min-h-14 items-center justify-center whitespace-nowrap rounded-full bg-[#b85138] px-6 py-4 text-sm font-bold text-white shadow-[0_18px_45px_-18px_rgba(184,81,56,0.9)] transition hover:-translate-y-0.5 hover:bg-[#a84631] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white xl:px-8 xl:text-base"
                >
                  {user.role === 'creator' ? 'Go to your dashboard' : 'Your subscriptions'} →
                </a>
              ) : (
                <a
                  href="/signup?role=creator"
                  className="inline-flex min-h-14 items-center justify-center whitespace-nowrap rounded-full bg-[#b85138] px-6 py-4 text-sm font-bold text-white shadow-[0_18px_45px_-18px_rgba(184,81,56,0.9)] transition hover:-translate-y-0.5 hover:bg-[#a84631] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white xl:px-8 xl:text-base"
                >
                  Reserve your founding spot →
                </a>
              )}

              <a
                href="#creator-walkthrough"
                className="inline-flex min-h-14 items-center justify-center whitespace-nowrap rounded-full border border-white/35 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white xl:px-8 xl:text-base"
              >
                See how ByUs works <span className="ml-3 text-sm" aria-hidden="true">▶</span>
              </a>
            </div>

            <div className="mt-7 flex items-start gap-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-[#58d4c3]" aria-hidden="true">
                <ShieldCheckIcon />
              </span>
              <div>
                <p className="text-base font-semibold text-white">Keep 90% for good</p>
                <p className="mt-1 text-sm leading-relaxed text-[#dce8eb]/65">
                  10% founding rate for US creators, standard domestic processing included.
                </p>
              </div>
            </div>

            {!user && <p className="mt-7 text-sm text-[#dce8eb]/60">$0 to reserve · No payment information required · Creator accounts open soon</p>}

            <p className="mt-7 max-w-sm font-script text-[2.5rem] font-medium leading-[0.88] text-[#67d8dc] sm:text-[3rem]">
              A more human<br />internet for creators.
              <span className="mt-2 block h-0.5 w-24 rotate-[-5deg] rounded-full bg-[#d25d3f]" aria-hidden="true" />
            </p>
          </div>

          <HeroCreatorExamples />
        </div>
      </div>
    </section>
  );
}

const HERO_CREATOR_EXAMPLES = [
  {
    name: 'Maya Sinclair',
    craft: 'Photographer',
    image: '/creators/maya-sinclair/hero.jpg',
    href: '/demo/maya-sinclair',
  },
  {
    name: 'Liam Carter',
    craft: 'Musician',
    image: '/creators/liam-carter/hero.jpg',
    href: '/demo/liam-carter',
  },
  {
    name: 'Elena Park',
    craft: 'ASL educator',
    image: '/creators/elena-park/hero.jpg',
    href: '/demo/elena-park',
  },
  {
    name: 'Sophie Lane',
    craft: 'Ceramic artist',
    image: '/creators/sophie-lane/hero-potter.jpg',
    href: '/demo/sophie-lane',
  },
];

function HeroCreatorExamples() {
  return (
    <div className="relative mx-auto w-full max-w-3xl lg:max-w-none">
      <div
        aria-hidden="true"
        className="absolute -inset-8 rounded-[3rem] bg-cyan-300/10 blur-3xl"
      />
      <div className="relative">
        {/* The film leads the column; the four example pages drop to one compact row
            under it (two by two on phones), so the hero doesn't grow much taller. */}
        <HeroFilm />
        <p className="mb-3 mt-6 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#7fd9ce] sm:text-xs lg:text-left">
          Example creator pages
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HERO_CREATOR_EXAMPLES.map((creator) => (
            <HeroCreatorCard key={creator.name} creator={creator} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroCreatorCard({ creator }) {
  return (
    <a
      href={creator.href}
      aria-label={`View ${creator.name}'s example creator page`}
      className="group relative block aspect-[5/4] overflow-hidden rounded-xl border border-white/20 bg-[#0b2037] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] outline-none transition duration-300 hover:-translate-y-1 hover:border-white/40 focus-visible:ring-2 focus-visible:ring-[#67d8dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#08182d] sm:aspect-[4/5]"
    >
      <Image
        src={creator.image}
        alt={`${creator.name}, ${creator.craft.toLowerCase()} — example ByUs creator page`}
        fill
        sizes="(min-width: 1280px) 160px, (min-width: 1024px) 14vw, (min-width: 640px) 24vw, 46vw"
        className="object-cover transition duration-500 group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#061321]/95 via-[#061321]/25 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
        <h2 className="font-display text-base font-semibold leading-tight text-white">{creator.name}</h2>
        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold xl:text-[10px]">
          {creator.craft}
        </p>
      </div>
    </a>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M16 3.5 26 7v8.1c0 6.3-4.2 11.1-10 13.4-5.8-2.3-10-7.1-10-13.4V7l10-3.5Z" />
      <path d="m11.5 15.8 3 3 6.5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Sits after the earnings calculator rather than up in the hero -- with only a
// handful of creators live so far, opening with "search for someone" before a
// visitor has any reason to have a name in mind would compete with the pitch for
// the first look. By the time someone's scrolled past the numbers, they're ready
// to either start their own page or go looking for one they already have in mind.
// Replaces the old icon+text feature cards with small, realistic previews of the
// product itself, so a visitor sees roughly what these look like inside ByUs
// instead of reading an icon standing in for the idea. Six cards: five plain
// single-column ones plus SmsNotificationsDemo, which spans both columns as the
// most recently shipped feature (see its own comment for why it gets the wide,
// "New"-pilled slot). Five singles is an odd count against a two-column grid, so
// one row is always left with a single card and an empty cell beside it --
// accepted rather than forcing a sixth single-column card just to balance the grid.
function Features() {
  return (
    <section id="features" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-16">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-[#172033]">
          Everything your community needs, nothing it doesn&rsquo;t
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-ink/70">
          No churn dashboards to configure — just the tools already built into ByUs to help a
          subscription community work.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TiersDemo />
        <CommunitySyncDemo />
        <ContentImportDemo />
        <VideoUploadDemo />
        <EngagementDemo />
        <SmsNotificationsDemo />
      </div>
    </section>
  );
}

function PayoutDemo() {
  return (
    <div className="rounded-2xl border border-brand-teal/30 bg-brand-paper p-6 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-brand-teal">Direct payouts</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">Every charge, split automatically</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
        Each creator connects their own Stripe Express account. Payouts land there directly — no
        manual transfers, no waiting on ByUs to release funds.
      </p>

      {/* A real receipt, not a made-up one -- $10/mo at the 10% founding-creator rate,
          the same math the EarningsCalculator above uses. */}
      <div className="mt-4 rounded-xl border border-brand-ink/10 bg-[#F8FAFC] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brand-ink/70">Membership charge</span>
          <span className="font-display font-bold tabular-nums text-[#172033]">$10.00</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-brand-ink/50">
          <span>Platform fee (10%)</span>
          <span className="tabular-nums">&minus;$1.00</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-brand-ink/15 pt-3 text-sm font-bold">
          <span className="text-brand-teal">You receive</span>
          <span className="font-display tabular-nums text-brand-teal">$9.00</span>
        </div>
      </div>
    </div>
  );
}

function TiersDemo() {
  const tiers = [
    { name: 'Supporter', price: 8 },
    { name: 'Insider', price: 10, popular: true },
    { name: 'VIP', price: 25 },
  ];
  return (
    <div className="rounded-2xl border border-brand-ink/15 bg-brand-paper p-6 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#0F766E]">Tiered memberships</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">Fans pick what fits</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
        Set your own prices and choose which posts are public or reserved for members.
      </p>
      <div className="mt-4 space-y-2">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 ${
              t.popular ? 'border-brand-gold bg-brand-gold/10' : 'border-brand-ink/15'
            }`}
          >
            <span className="text-sm font-semibold text-[#172033]">{t.name}</span>
            <span className="text-sm font-bold tabular-nums text-brand-ink/70">${t.price}/mo</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GatedContentDemo() {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-ink/15 bg-brand-paper shadow-sm">
      <div className="relative aspect-[16/10]">
        <Image
          src="/creators/alex-rivers/detail-piece.jpg"
          alt="Example of a members-only post, shown locked"
          fill
          sizes="(min-width: 1024px) 22vw, 90vw"
          className="object-cover blur-[3px] scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-[#172033]/45">
          <span className="flex items-center gap-1.5 rounded-full bg-brand-paper/95 px-3.5 py-1.5 text-xs font-bold text-[#172033]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Members only
          </span>
        </div>
      </div>
      <div className="p-5">
        <span className="text-xs font-extrabold uppercase tracking-wide text-brand-clay">Gated content</span>
        <p className="mt-1.5 text-sm leading-relaxed text-brand-ink/70">
          Post public or subscribers-only updates. Access turns off the moment a subscription lapses
          or is canceled.
        </p>
      </div>
    </div>
  );
}

// Discord's own brand blurple (#5865F2) as this card's accent, the same way GatedContentDemo
// borrows brand-clay -- each feature card gets a color that's actually its own rather than
// all four sharing the platform's teal. Kept as a compact perk card, not a full demo like
// PayoutDemo/TiersDemo, since there's no single UI moment (a role grant, a Telegram invite)
// that reads at a glance the way a receipt or a tier list does.
function CommunitySyncDemo() {
  return (
    <div className="rounded-2xl border border-brand-ink/15 bg-brand-paper p-6 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#5865F2]">Community tools</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">Community, synced automatically</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
        Connect Discord or Telegram for automatic member access, and let fans opt into text
        notifications when you publish something new.
      </p>
    </div>
  );
}

// Describes the real RSS feature (see lib/rss.js / app/api/creator/rss/route.js and the
// RssImportCard in Settings) accurately: it's an IMPORT, from the creator's existing blog
// into ByUs -- not a private feed ByUs hands back out to fans. Orange as this card's accent
// is the closest thing RSS has to a brand color, same "borrow a color that's actually its
// own" reasoning as GatedContentDemo (brand-clay) and CommunitySyncDemo (Discord blurple).
function ContentImportDemo() {
  return (
    <div className="rounded-2xl border border-brand-ink/15 bg-brand-paper p-6 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#EA580C]">Bring your content</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">Start with work you already own</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
        Import posts from WordPress, Ghost, or Substack by RSS, or upload video files from your
        device. Link imports and bulk channel transfers are not currently supported.
      </p>
    </div>
  );
}

// Was the feed's "newest addition" (the post_likes table and view_count column,
// added Sep 18, 2026) and held the wide, "New"-pilled slot below for exactly one day
// -- SmsNotificationsDemo takes that slot over now that it's the more recent
// shipment, so this reverts to the same plain single-column treatment as
// TiersDemo/CommunitySyncDemo/RssImportDemo. Amber stays its accent (still the one
// brand-gold-family shade no other card claims); the view/like chips move from a
// side-by-side strip to a stacked one now that the card is back to a single column.
function EngagementDemo() {
  return (
    <div className="rounded-2xl border border-brand-ink/15 bg-brand-paper p-6 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#B45309]">Engagement</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">See what&rsquo;s actually landing</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
        Fans can like any post, and every post tracks its own view count — both show up on your
        dashboard so you know what&rsquo;s connecting, not just what you posted.
      </p>
      <div className="mt-4 flex gap-4 rounded-xl border border-brand-ink/10 bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-brand-ink/70">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">👁</span> 1.2K views
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-[#A6432E]">♥</span> 340 likes
        </span>
      </div>
    </div>
  );
}

// Creators can bring prerecorded videos they already own into a ByUs post through
// the dashboard's direct Mux upload flow. This is deliberately described as a file upload,
// not an automatic YouTube/TikTok/Patreon migration: each video is attached to a post and
// the creator chooses Public or Subscribers only. The small player preview mirrors that
// straightforward workflow rather than implying a bulk-import feature that does not exist.
function VideoUploadDemo() {
  return (
    <div className="rounded-2xl border border-brand-ink/15 bg-brand-paper p-6 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#7C3AED]">
        Video uploads
      </span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">
        Bring the videos you already have
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
        Have the file on your device? Upload an MP4, MOV, WebM, or M4V from TikTok,
        YouTube, your phone, or another platform—provided it’s yours to reuse—then choose
        whether approved videos publish publicly or for subscribers only.
      </p>
      <div className="mt-4 flex aspect-video items-center justify-center rounded-xl bg-[#172033]">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 pl-0.5 text-[#7C3AED] shadow-lg" aria-hidden="true">
          ▶
        </span>
      </div>
      <p className="mt-3 text-xs text-brand-ink/55">
        Up to 30 minutes and 2 GB per video, with resolutions up to 4K. Every video gets an
        automatic safety scan before fans see it, usually within minutes; a new creator&rsquo;s
        first video also gets a quick human review. ByUs cannot pull from a TikTok or YouTube
        link or bulk-import a channel or library.
      </p>
    </div>
  );
}

// The newest addition to the feed (see lib/sms.js, the phone_verification_codes
// table, and TextNotificationsCard in app/settings/SettingsClient.js) — inherits the
// wide, "New"-pilled slot EngagementDemo held above, for the same reason: whichever
// feature actually shipped last gets the extra width, not a permanent claim on it.
// The heading is written to land for both audiences at once ("you post" / "they
// know") since this pitches fans (opt in, stop missing posts) and creators (fans
// hear about new work the moment it's up) equally, per how the feature was scoped.
// Green as its accent, the same "borrow a color that's actually its own" reasoning
// as Discord blurple and RSS orange -- it's the color of an SMS/MMS bubble on a
// phone (as opposed to iMessage blue), so "text message" reads before any label
// does. The mock notification is a lock-screen-style preview rather than an icon
// standing in for the idea, matching how PayoutDemo shows a real receipt and
// GatedContentDemo shows a real locked post.
function SmsNotificationsDemo() {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-brand-ink/15 bg-brand-paper p-6 shadow-sm sm:col-span-2 sm:flex-row sm:items-center">
      <div>
        <span className="inline-flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#16A34A]">
            Text notifications
          </span>
          <span className="rounded-full bg-[#16A34A]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#15803D]">
            New
          </span>
        </span>
        <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">
          The moment you post, they know
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-brand-ink/70">
          Fans verify a phone number once in Settings, then get a text the second a creator they
          follow publishes something new — no app to open, no feed to scroll and hope you catch it.
        </p>
      </div>
      <div className="w-full shrink-0 rounded-xl border border-brand-ink/10 bg-[#F8FAFC] p-3.5 sm:w-64">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#16A34A] text-[10px] font-bold text-white">
            B
          </span>
          <span className="text-xs font-bold text-[#172033]">ByUs</span>
          <span className="ml-auto text-[10px] font-medium text-brand-ink/40">now</span>
        </div>
        <p className="mt-1.5 text-xs leading-snug text-brand-ink/70">
          Alex Rivers just posted: &ldquo;New behind-the-scenes video is up 🎬&rdquo; — tap to view
        </p>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Create your page',
      body: 'Add a bio, a photo, and one or more monthly tiers with your own pricing.',
    },
    {
      n: '02',
      title: 'Connect payments',
      body: 'Link your own Stripe Express account once — it stays connected, no re-linking required.',
    },
    {
      n: '03',
      title: 'Share with your audience',
      body: 'Publish public updates to bring people in, and subscriber-only posts to reward them for joining.',
    },
    {
      n: '04',
      title: 'Get paid',
      body: 'Every charge splits automatically — your share lands in your Stripe account directly, no manual invoicing.',
    },
  ];
  return (
    <section id="how-it-works" className="bg-brand-paper">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center font-display text-3xl font-semibold text-[#172033]">
          From Passion to Paycheck in 4 Steps
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 min-[380px]:grid-cols-2 sm:grid-cols-4 sm:gap-y-10">
          {steps.map((s, i) => (
            <div key={s.n} className="relative text-left">
              <span className="font-display text-3xl font-semibold text-brand-gold/70">{s.n}</span>
              <h3 className="mt-3 font-semibold text-[#172033]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{s.body}</p>
              {i < steps.length - 1 && (
                <span
                  className="absolute right-[-1.25rem] top-2 hidden text-brand-ink/35 sm:block"
                  aria-hidden="true"
                >
                  &rarr;
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function WhyWeBuiltByUs({ user }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';
  return (
    <section className="relative overflow-hidden bg-brand-teal">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-brand-gold/15 blur-3xl"
      />
      <div className="relative mx-auto max-w-4xl px-6 py-14 sm:py-16">
        <div className="text-center">
          <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-gold">
            Our reason for building ByUs
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">
            Creators deserve better.
          </h2>
          <div className="mx-auto mt-5 max-w-2xl space-y-3 text-base leading-relaxed text-white/80">
            <p>
              ByUs began with a conversation. A creator told us that a supporter spent $500 sending
              her virtual gifts on another platform—but only about $200 reached her.
            </p>
            <p>
              Creators do the work, build the communities, and create the value. They deserve to
              keep more of what they earn. ByUs gives fans a simpler, more transparent way to
              support them through memberships or tips on the posts they love—without confusing
              coins or gift conversions.
            </p>
          </div>
          <a
            href={user ? dashboardHref : '/signup?role=creator'}
            className="mt-7 inline-flex rounded-full bg-brand-paper px-7 py-3 font-semibold text-brand-teal shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            {user ? 'Go to your dashboard' : 'Reserve a founding spot'} →
          </a>
          {!user && (
            <p className="mt-4 text-xs text-white/60">
              No follower minimum · Payments secured by Stripe
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// FoundingCreatorProgram perk-card icons -- same 24x24/1.8-stroke convention as the
// icons above, sized to sit inside a fixed 40px icon tile.
function RankIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 19v-6" strokeLinecap="round" />
      <path d="M12 19V9" strokeLinecap="round" />
      <path d="M19 19V5" strokeLinecap="round" />
      <path d="M3 19h18" strokeLinecap="round" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9" strokeLinecap="round" />
      <path d="M16 7l3 3" strokeLinecap="round" />
      <path d="M13 10l2 2" strokeLinecap="round" />
    </svg>
  );
}

// FoundingCreatorProgram's third perk card -- "skip the wait," visualized as two
// chevrons past a bar rather than a literal clock/calendar, to read as "ahead of the
// line" instead of "time passing."
function FastForwardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6v12" strokeLinecap="round" />
      <path d="M9 7l7 5-7 5V7z" strokeLinejoin="round" />
      <path d="M16 7l7 5-7 5V7z" strokeLinejoin="round" />
    </svg>
  );
}
