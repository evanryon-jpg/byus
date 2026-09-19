import Image from 'next/image';
import { getCurrentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { getFoundingPromoStats } from '@/lib/fees';
import FAQSection from './components/FAQSection';
import { FAQS } from './components/faqs-data';
import CreatorSearch from './components/CreatorSearch';
import FeaturedCreators from './components/FeaturedCreators';
import EarningsCalculator from './components/EarningsCalculator';
import CreatorShowcase from './components/CreatorShowcase';
import FeedbackWidget from './components/FeedbackWidget';

// Server component so the hero and closing CTAs can tell whether someone is already
// logged in -- an existing creator or fan should never be invited to sign up again,
// they should be pointed straight back to the page they actually want.
// FAQPage structured data for search engines -- built from the exact same FAQS array
// FAQSection.jsx renders, so this can never say something the visible accordion
// doesn't. The accordion only puts one answer's text in the DOM at a time (whichever
// item is expanded); this script tag is what guarantees every Q&A is machine-readable
// regardless of which one a visitor has open.
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
  const session = await getCurrentUser();
  const foundingStats = await getFoundingPromoStats(query);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FeedbackWidget />
      <Hero user={session} />
      <CreatorShowcase />
      <EarningsCalculator />
      <Features />
      <FoundingCreatorProgram stats={foundingStats} />
      <HowItWorks />
      <LookingForSomeoneSection />
      <FeaturedCreators />
      <FAQSection />
      <WhyWeBuiltByUs />
      {/* PlatformGoalGauge (app/components/PlatformGoalGauge.jsx) pulled for now -- with
          one creator and no revenue yet, "our best month so far: $0.00" reads as a red
          flag to a visitor rather than a growth story. Bring it back once there's an
          actual best month worth showing. */}
      <ClosingCta user={session} />
    </div>
  );
}

// The Founding Creator Program, merged into one premium section (previously two --
// FoundingPromoBanner's fee-framing banner and FoundersCircleSection's two perk cards
// -- which repeated the same "founding creators keep more, sooner" point twice back to
// back). `stats` comes straight from lib/fees.js's getFoundingPromoStats(), which
// counts real creator signups (`SELECT COUNT(*) FROM users WHERE role='creator'`) --
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
// Creator signup and Stripe Connect onboarding are open. ByUs's own platform payout
// remains under Stripe review, but connected creator onboarding and payments are not
// presented as paused. The real creator count determines remaining founding spots.
function FoundingCreatorProgram({ stats }) {
  const soldOut = stats.remaining <= 0;
  const perks = [
    {
      icon: <RankIcon />,
      title: 'Priority placement',
      body: `Automatically sorted first in Browse Creators and the homepage's showcase — before things get crowded.`,
    },
    {
      icon: <KeyIcon />,
      title: 'No follower minimum',
      body: `Zero followers required. Set up tiers, publish posts, and get paid directly — no algorithm gatekeeping who gets to monetize.`,
    },
    {
      icon: <FastForwardIcon />,
      title: 'Skip the $2,000/mo wait',
      body: `Standard accounts reach 10% once they're earning $2,000/mo on ByUs. Founding creators start there, from day one.`,
    },
  ];

  return (
    <section className="relative overflow-hidden bg-[#172554]">
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
          The first {stats.limit} creators to join lock in our lowest fee for good — everyone else
          earns their way there at $2,000/mo.
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
              All {stats.limit} founding spots have been claimed — standard rates now apply to new
              signups.
            </p>
          ) : (
            <>
              <a
                href="/signup?role=creator"
                className="inline-block rounded-full bg-brand-gold px-8 py-3.5 text-base font-bold text-[#172554] shadow-[0_16px_30px_-14px_rgba(15,118,110,0.5)] transition hover:-translate-y-0.5"
              >
                Join the founding waitlist →
              </a>
              <p className="mt-3 text-sm font-medium tabular-nums text-brand-paper/55">
                <strong className="font-display text-base text-brand-paper">
                  {stats.remaining.toLocaleString()}
                </strong>{' '}
                founding {stats.remaining === 1 ? 'spot remains' : 'spots remain'}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Hero({ user }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    // Dark band fading down into the page's own cream. Two columns on desktop now --
    // copy on the left, a small editorial collage of real Alex Rivers artwork on the
    // right, so the hero shows what a ByUs page actually looks like instead of telling
    // you. Stacks to a single column on mobile, art below the copy, so the CTAs and
    // fine print still come first for outreach traffic.
    <section className="relative overflow-hidden bg-gradient-to-b from-[#172554] via-[#134B61] to-brand-cream">
      {/* Two subtle ambient color glows add depth to the dark band without
          competing with the message or creator previews. Purely
          decorative background motion, kept separate from the live-pulse dot on the
          demo link below (which is tied to something real); `motion-safe:` means
          prefers-reduced-motion is handled without any JS. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-28 h-[560px] w-[560px] rounded-full blur-md motion-safe:animate-byus-drift"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.12), transparent 65%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-36 bottom-[10%] h-[420px] w-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.08), transparent 65%)' }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-14 pb-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="text-left">
            <span className="inline-flex -rotate-2 items-center gap-2 rounded border border-dashed border-brand-gold bg-brand-gold/10 px-4 py-1.5 font-display text-xs font-semibold italic tracking-wide text-brand-gold">
              Made for creators, built around fairness
            </span>

            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-brand-paper sm:text-5xl lg:text-[3.25rem]">
              You keep{' '}
              <span className="relative inline-block whitespace-nowrap">
                87&ndash;90%
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  height="10"
                  viewBox="0 0 200 10"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M2 6 Q 50 1, 100 5 T 198 6" stroke="#0F766E" strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
              </span>{' '}
              on ByUs. Period.
            </h1>

            <p className="mt-3 font-display text-xl italic text-brand-paper/60">
              The home your fans keep coming back to.
            </p>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-paper/75">
              Build your page, connect payments, and share your work — tiers, posts, and
              payouts handled, with standard domestic payment processing covered in that fee.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {user ? (
                <a
                  href={dashboardHref}
                  className="rounded-full bg-[#0F766E] px-7 py-3.5 text-base font-semibold text-brand-paper shadow-[0_16px_30px_-14px_rgba(15,118,110,0.38)] transition hover:-translate-y-0.5 hover:bg-[#115E59]"
                >
                  {user.role === 'creator' ? 'Go to your dashboard' : 'Your subscriptions'} →
                </a>
              ) : (
                <a
                  href="/signup?role=creator"
                  className="rounded-full bg-[#0F766E] px-7 py-3.5 text-base font-semibold text-brand-paper shadow-[0_16px_30px_-14px_rgba(15,118,110,0.38)] transition hover:-translate-y-0.5 hover:bg-[#115E59]"
                >
                  Join the creator waitlist →
                </a>
              )}

              {/* Anchors down to HowItWorks -- for a visitor who isn't ready to commit
                  to either CTA yet, this answers "okay, but how does it actually work"
                  without leaving the page. */}
              <a
                href="#how-it-works"
                className="rounded-full border-2 border-brand-paper/30 bg-brand-paper/10 px-7 py-3.5 text-base font-semibold text-brand-paper backdrop-blur transition hover:border-brand-gold hover:bg-brand-paper/15"
              >
                See How It Works
              </a>
            </div>

            {/* The live-demo link, demoted from a filled pill to plain text with a small
                live-pulse dot -- it still lets a skeptical creator click through the
                whole product (tiers, a locked post unlocking, the payout math) before
                committing to an account, but it no longer competes with the two primary
                CTAs above for the first look. */}
            <p className="mt-5 flex items-center gap-2 text-sm text-brand-paper/60">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-gold opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-gold" />
              </span>
              <a href="/demo" className="font-semibold underline-offset-2 hover:underline">
                View a live demo
              </a>
              — no sign-up required
            </p>

            <p className="mt-4 text-base font-semibold text-brand-paper/85">
              $0 to start&nbsp;&nbsp;·&nbsp;&nbsp;fee drops to 10% once you're earning $2k+/mo&nbsp;&nbsp;·&nbsp;&nbsp;cancel anytime
            </p>
          </div>

          <HeroArtCollage />
        </div>
      </div>
    </section>
  );
}

// A small editorial collage of real artwork from Alex Rivers's page (see
// /public/creators/alex-rivers and the live /demo route) -- three crops, offset and
// lightly rotated like pinned prints rather than a clean grid, so the hero shows a
// real example of "what you can build" instead of describing it. The member-exclusive
// crop keeps a light blur and lock badge so a first-time visitor also sees, at a
// glance, that gated content is part of the picture. All three sit inside the Hero
// section's own `overflow-hidden`, so the small negative offsets that give the pinned
// look never cause page-level horizontal scroll.
function HeroArtCollage() {
  const creators = [
    {
      name: 'Maya Sinclair',
      specialty: 'Illustrator & artist',
      image: '/creators/maya-sinclair/hero.jpg',
      accent: 'bg-brand-clay',
      detail: 'Process posts · Brush packs',
    },
    {
      name: 'Liam Carter',
      specialty: 'Fitness coach',
      image: '/creators/liam-carter/hero.jpg',
      accent: 'bg-brand-teal',
      detail: 'Workouts · Member guides',
    },
    {
      name: 'Elena Park',
      specialty: 'Educator',
      image: '/creators/elena-park/hero.jpg',
      accent: 'bg-brand-clay',
      detail: 'Lessons · PDF downloads',
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl pb-8 lg:max-w-none">
      <div
        aria-hidden="true"
        className="absolute inset-x-[8%] inset-y-[5%] rounded-full bg-blue-300/20 blur-3xl"
      />

      <div className="relative grid min-h-[430px] grid-cols-2 items-center gap-3 sm:min-h-[470px] sm:gap-4">
        {creators.map((creator, index) => (
          <article
            key={creator.name}
            className={`overflow-hidden rounded-2xl border-[5px] border-white bg-white shadow-[0_24px_55px_-22px_rgba(23,37,84,0.45)] ${
              index === 0
                ? '-rotate-3 self-end'
                : index === 1
                ? 'z-10 row-span-2 rotate-1'
                : 'col-start-1 row-start-2 -mt-5 rotate-2'
            }`}
          >
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-slate-100">
              <Image
                src={creator.image}
                alt={`${creator.name}, an example ByUs creator`}
                fill
                sizes="(min-width: 1024px) 20vw, 42vw"
                className="object-cover"
                priority={index === 1}
              />
            </div>
            <div className="p-3 sm:p-4">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${creator.accent}`}>
                  {creator.name.split(' ').map((part) => part[0]).join('')}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-ink">{creator.name}</p>
                  <p className="truncate text-xs text-brand-ink/55">{creator.specialty}</p>
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-brand-ink/65">{creator.detail}</p>
              <div className={`mt-3 rounded-full px-3 py-2 text-center text-xs font-bold text-white ${creator.accent}`}>
                View creator page
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="relative mt-1 text-center text-xs text-brand-ink/45">
        Memberships, posts, and downloads — all in one creator page.
      </p>
    </div>
  );
}

function LockGlyphLarge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// Sits after the earnings calculator rather than up in the hero -- with only a
// handful of creators live so far, opening with "search for someone" before a
// visitor has any reason to have a name in mind would compete with the pitch for
// the first look. By the time someone's scrolled past the numbers, they're ready
// to either start their own page or go looking for one they already have in mind.
function LookingForSomeoneSection() {
  return (
    <section className="mx-auto max-w-xl px-6 py-2 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-wide text-brand-ink/50">
        Looking for someone specific?
      </p>
      <div className="mt-2 flex justify-center">
        <CreatorSearch />
      </div>
    </section>
  );
}

// Replaces the old icon+text feature cards with small, realistic previews of the
// product itself -- a mock payout breakdown, a mock tier picker, and a locked post --
// so a visitor sees roughly what these look like inside ByUs instead of reading an
// icon standing in for the idea. The gated-content preview reuses real Alex Rivers
// artwork (detail-piece.jpg) with the same blur+lock treatment as the live /demo
// route's LockedHeroPiece, so the "locked" language on this page and the real product
// look identical.
function Features() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-[#172033]">
          Everything a ByUs membership needs, nothing it doesn&rsquo;t
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-ink/70">
          No churn dashboards to configure — just the parts that make a subscription work, shown as
          they actually appear.
        </p>
      </div>

      {/* Seven cards in one grid -- previously Direct payouts sat in an oversized
          slot beside a stacked 2x2 of the rest, sized with h-full so it stretched to
          match whatever height the stack beside it happened to reach. That worked at
          four compact cards; once Engagement became a fifth, the stack grew taller
          than the payout card needed and the stretch left a large empty gap inside
          it. All cards now share one card treatment and one grid, so each card is
          exactly as tall as its own content instead of being stretched to match a
          sibling column. Text notifications is the seventh, and takes over the wide
          "newest shipment" slot Engagement held until this one shipped -- see
          SmsNotificationsDemo below. */}
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <PayoutDemo />
        <TiersDemo />
        <GatedContentDemo />
        <CommunitySyncDemo />
        <RssImportDemo />
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
    { name: 'Supporter', price: 5 },
    { name: 'Insider', price: 10, popular: true },
    { name: 'VIP', price: 25 },
  ];
  return (
    <div className="rounded-2xl border border-brand-ink/15 bg-brand-paper p-6 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#0F766E]">Tiered memberships</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">Fans pick what fits</h3>
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
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#5865F2]">Discord &amp; Telegram</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">Community, synced automatically</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
        Connect a Discord server or Telegram group and subscribers get a role or an invite the
        moment they join — removed automatically if they ever cancel.
      </p>
    </div>
  );
}

// Describes the real RSS feature (see lib/rss.js / app/api/creator/rss/route.js and the
// RssImportCard in Settings) accurately: it's an IMPORT, from the creator's existing blog
// into ByUs -- not a private feed ByUs hands back out to fans. Orange as this card's accent
// is the closest thing RSS has to a brand color, same "borrow a color that's actually its
// own" reasoning as GatedContentDemo (brand-clay) and CommunitySyncDemo (Discord blurple).
function RssImportDemo() {
  return (
    <div className="rounded-2xl border border-brand-ink/15 bg-brand-paper p-6 shadow-sm">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#EA580C]">RSS import</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#172033]">Already blogging? Bring it with you</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
        Point ByUs at your WordPress, Ghost, or Substack feed, then sync in one click any time
        you publish — no copy-pasting, no second place to write.
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
          Up and running on ByUs in four steps
        </h2>

        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 sm:gap-y-10">
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


function WhyWeBuiltByUs() {
  return (
    <section className="relative overflow-hidden bg-brand-cream">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-brand-gold/15 blur-3xl"
      />
      <div className="relative mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <div className="rounded-3xl border border-brand-ink/10 bg-brand-paper px-7 py-10 shadow-sm sm:px-12 sm:py-12">
          <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-clay">
            Our reason for building ByUs
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold text-[#172033] sm:text-4xl">
            Creators deserve better.
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-brand-ink/75 sm:text-lg">
            <p>
              ByUs began with a conversation. A creator told us that a supporter spent $500 sending
              her virtual gifts on another platform—but only about $200 reached her.
            </p>
            <p className="font-display text-xl font-semibold text-brand-teal">
              That didn&rsquo;t feel right.
            </p>
            <p>
              Creators do the work, build the communities, and create the value. They deserve to
              keep more of what they earn. ByUs gives fans a simpler, more transparent way to
              support them through memberships or direct tips—without confusing coins or gift
              conversions.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ user }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    <section className="relative overflow-hidden bg-brand-teal">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-gold/20 blur-3xl" />
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
          {user ? 'Welcome back.' : 'Ready to get started?'}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/75">
          {user
            ? 'Pick up right where you left off.'
            : 'Whether you’re here to support someone or to build your own membership, it takes a couple of minutes to set up.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {user ? (
            <a
              href={dashboardHref}
              className="rounded-full bg-brand-paper px-7 py-3 font-semibold text-brand-teal shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Go to your dashboard
            </a>
          ) : (
            <a
              href="/signup"
              className="rounded-full bg-brand-paper px-7 py-3 font-semibold text-brand-teal shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Create your account
            </a>
          )}
          <a
            href="/browse"
            className="rounded-full border border-white/40 px-7 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            Browse creators
          </a>
        </div>
        {!user && (
          <p className="mt-5 text-xs text-white/50">🔒 Payments secured by Stripe</p>
        )}
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
