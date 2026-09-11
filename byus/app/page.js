import Image from 'next/image';
import { getCurrentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { getFoundingPromoStats } from '@/lib/fees';
import FAQSection from './components/FAQSection';
import CreatorSearch from './components/CreatorSearch';
import FeaturedCreators from './components/FeaturedCreators';
import EarningsCalculator from './components/EarningsCalculator';
import CreatorShowcase from './components/CreatorShowcase';

// Server component so the hero and closing CTAs can tell whether someone is already
// logged in -- an existing creator or fan should never be invited to sign up again,
// they should be pointed straight back to the page they actually want.
export default async function HomePage() {
  const session = await getCurrentUser();
  const foundingStats = await getFoundingPromoStats(query);

  return (
    <div>
      <Hero user={session} />
      <CreatorShowcase />
      <EarningsCalculator />
      <FoundingCreatorProgram stats={foundingStats} />
      <Features />
      <HowItWorks />
      <LookingForSomeoneSection />
      <FeaturedCreators />
      <FAQSection />
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
// SPOTS. 7% FOREVER." framing from the brief is built from `stats.limit` rather than a
// bare "100" so the copy stays correct if FOUNDING_CREATOR_LIMIT in lib/pricing.js ever
// changes; "7%" is left as a literal since it mirrors that same file's permanent
// MIN_FEE_PERCENT/DISCOUNTED_FEE_PERCENT constant. Every claim below is scoped to what's
// actually live: the fee is a permanent 7% (never "0%" or "keep 100%"), priority
// placement is real (see the is_founding ordering in /api/creators), and there's no
// human-curation layer, brand-deal matching, or other feature ByUs doesn't have --
// none of that is implied here.
//
// Styled as its own dark, premium panel rather than blending into the cream page
// background, so "Founding Creator Program" reads as a distinct, limited offer rather
// than another feature bullet -- the treatment the brief asked for when it said this
// needed to be "more visible."
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
      body: `Standard accounts reach 7% once they're earning $2,000/mo on ByUs. Founding creators start there, from day one.`,
    },
  ];

  return (
    <section className="relative overflow-hidden bg-[#0e2620]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(201,169,97,0.18), transparent 65%)' }}
      />

      <div className="relative mx-auto max-w-5xl px-6 py-20 text-center">
        <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-gold">
          Founding Creator Program
        </span>
        <p className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold leading-tight text-brand-paper sm:text-5xl">
          {stats.limit} spots. <span className="text-brand-gold">7% forever.</span>
        </p>
        <p className="mx-auto mt-4 max-w-lg text-brand-paper/70">
          The first {stats.limit} creators to join lock in our lowest fee for good — everyone else
          earns their way there at $2,000/mo.
        </p>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
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

        <div className="mt-10">
          {soldOut ? (
            <p className="text-sm font-semibold text-brand-paper/70">
              All {stats.limit} founding spots have been claimed — standard rates now apply to new
              signups.
            </p>
          ) : (
            <>
              <a
                href="/signup?role=creator"
                className="inline-block rounded-full bg-brand-gold px-8 py-3.5 text-base font-bold text-[#0e2620] shadow-[0_16px_30px_-14px_rgba(201,169,97,0.5)] transition hover:-translate-y-0.5"
              >
                Claim a Founding Spot →
              </a>
              <p className="mt-3 text-sm font-medium tabular-nums text-brand-paper/55">
                <strong className="font-display text-base text-brand-paper">{stats.remaining}</strong> of{' '}
                {stats.limit} spots left
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
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0f201c] via-[#142c26] to-brand-cream">
      {/* Two blurred, ambiently drifting color blobs -- clay top-right, gold
          bottom-left -- give the dark band some depth instead of a flat fill. Purely
          decorative background motion, kept separate from the live-pulse dot on the
          demo link below (which is tied to something real); `motion-safe:` means
          prefers-reduced-motion is handled without any JS. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-28 h-[560px] w-[560px] rounded-full blur-md motion-safe:animate-byus-drift"
        style={{ background: 'radial-gradient(circle, rgba(201,124,93,0.28), transparent 65%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-36 bottom-[10%] h-[420px] w-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(201,169,97,0.16), transparent 65%)' }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-left">
            <span className="inline-flex -rotate-2 items-center gap-2 rounded border border-dashed border-brand-gold bg-brand-gold/10 px-4 py-1.5 font-display text-xs font-semibold italic tracking-wide text-brand-gold">
              Made for creators, built around fairness
            </span>

            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-brand-paper sm:text-5xl lg:text-[3.25rem]">
              You keep{' '}
              <span className="relative inline-block whitespace-nowrap">
                90&ndash;93%
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  height="10"
                  viewBox="0 0 200 10"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M2 6 Q 50 1, 100 5 T 198 6" stroke="#C9A961" strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
              </span>
              . Period.
            </h1>

            <p className="mt-3 font-display text-xl italic text-brand-paper/60">
              The creator-first membership platform.
            </p>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-paper/75">
              Build your page, connect payments, and share your work — tiers, posts, and
              payouts handled, with Stripe's processing already covered in that fee.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {user ? (
                <a
                  href={dashboardHref}
                  className="rounded-full bg-gradient-to-br from-brand-clay to-[#b6613f] px-7 py-3.5 text-base font-semibold text-brand-paper shadow-[0_16px_30px_-14px_rgba(201,124,93,0.65)] transition hover:-translate-y-0.5"
                >
                  {user.role === 'creator' ? 'Go to your dashboard' : 'Your subscriptions'} →
                </a>
              ) : (
                <a
                  href="/signup?role=creator"
                  className="rounded-full bg-gradient-to-br from-brand-clay to-[#b6613f] px-7 py-3.5 text-base font-semibold text-brand-paper shadow-[0_16px_30px_-14px_rgba(201,124,93,0.65)] transition hover:-translate-y-0.5"
                >
                  Start Creating →
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
              $0 to start&nbsp;&nbsp;·&nbsp;&nbsp;fee drops to 7% once you're earning $2k+/mo&nbsp;&nbsp;·&nbsp;&nbsp;cancel anytime
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
  return (
    <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
      <div className="relative aspect-[9/10] w-full">
        <div className="absolute inset-x-[6%] top-0 h-[62%] -rotate-2 overflow-hidden rounded-sm border-[5px] border-brand-paper shadow-[0_30px_55px_-20px_rgba(0,0,0,0.55)]">
          <Image
            src="/creators/alex-rivers/hero.jpg"
            alt="A landscape illustration from a ByUs creator's page — an example of the artwork a member's public feed can show"
            fill
            sizes="(min-width: 1024px) 34vw, 78vw"
            className="object-cover"
            priority
          />
        </div>

        <div className="absolute bottom-[4%] left-0 h-[42%] w-[54%] rotate-1 overflow-hidden rounded-sm border-[5px] border-brand-paper shadow-[0_22px_44px_-18px_rgba(0,0,0,0.5)]">
          <Image
            src="/creators/alex-rivers/portrait-process.jpg"
            alt="A portrait study from a ByUs creator's page"
            fill
            sizes="(min-width: 1024px) 20vw, 42vw"
            className="object-cover"
            style={{ objectPosition: '78% 42%' }}
          />
        </div>

        <div className="absolute bottom-[10%] right-0 h-[34%] w-[38%] rotate-3 overflow-hidden rounded-sm border-[5px] border-brand-paper shadow-[0_18px_36px_-16px_rgba(0,0,0,0.5)]">
          <Image
            src="/creators/alex-rivers/member-exclusive.jpg"
            alt="A members-only piece from a ByUs creator's page, shown blurred behind its lock"
            fill
            sizes="(min-width: 1024px) 16vw, 30vw"
            className="object-cover blur-[2px] scale-105"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1a16]/35">
            <LockGlyphLarge />
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-brand-paper/40 lg:text-left">
        From Alex Rivers's page — see the full interactive version in the live demo.
      </p>
    </div>
  );
}

function LockGlyphLarge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFCF6" strokeWidth="2" aria-hidden="true">
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
    <section className="mx-auto max-w-xl px-6 py-4 text-center">
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
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-[#2B2420]">
          Everything a membership needs, nothing it doesn&rsquo;t
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-ink/70">
          No churn dashboards to configure — just the parts that make a subscription work, shown as
          they actually appear.
        </p>
      </div>

      {/* Asymmetric rhythm instead of three uniform boxes -- Direct payouts gets the
          big slot since Stripe Express payouts are the actual differentiator, the
          other two stack beside it rather than competing for equal weight. */}
      <div className="mt-14 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <PayoutDemo />
        <div className="flex flex-col gap-6">
          <TiersDemo />
          <GatedContentDemo />
        </div>
      </div>
    </section>
  );
}

function PayoutDemo() {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-brand-teal/30 bg-brand-paper p-8 shadow-sm">
      <div>
        <span className="text-xs font-extrabold uppercase tracking-wide text-brand-teal">Direct payouts</span>
        <h3 className="mt-2 font-display text-xl font-bold text-[#2B2420]">Every charge, split automatically</h3>
        <p className="mt-2 max-w-md text-brand-ink/70">
          Each creator connects their own Stripe Express account. Payouts land there directly — no
          manual transfers, no waiting on ByUs to release funds.
        </p>
      </div>

      {/* A real receipt, not a made-up one -- $10/mo at the 7% founding-creator rate,
          the same math the EarningsCalculator above uses. */}
      <div className="mt-6 rounded-xl border border-brand-ink/10 bg-[#F5E9D8] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brand-ink/70">Membership charge</span>
          <span className="font-display font-bold tabular-nums text-[#2B2420]">$10.00</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-brand-ink/50">
          <span>Platform fee (7%)</span>
          <span className="tabular-nums">&minus;$0.70</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-brand-ink/15 pt-3 text-sm font-bold">
          <span className="text-brand-teal">You receive</span>
          <span className="font-display tabular-nums text-brand-teal">$9.30</span>
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
      <span className="text-xs font-extrabold uppercase tracking-wide text-[#8a6b2f]">Tiered memberships</span>
      <h3 className="mt-2 font-display text-lg font-bold text-[#2B2420]">Fans pick what fits</h3>
      <div className="mt-4 space-y-2">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 ${
              t.popular ? 'border-brand-gold bg-brand-gold/10' : 'border-brand-ink/15'
            }`}
          >
            <span className="text-sm font-semibold text-[#2B2420]">{t.name}</span>
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
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f1a16]/45">
          <span className="flex items-center gap-1.5 rounded-full bg-brand-paper/95 px-3.5 py-1.5 text-xs font-bold text-[#2B2420]">
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
      <div className="mx-auto max-w-5xl px-6 py-24">
        <h2 className="text-center font-display text-3xl font-semibold text-[#2B2420]">
          Up and running in four steps
        </h2>

        <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4 sm:gap-y-10">
          {steps.map((s, i) => (
            <div key={s.n} className="relative text-left">
              <span className="font-display text-3xl font-semibold text-brand-gold/70">{s.n}</span>
              <h3 className="mt-3 font-semibold text-[#2B2420]">{s.title}</h3>
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

function ClosingCta({ user }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    <section className="relative overflow-hidden bg-brand-teal">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-gold/20 blur-3xl" />
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
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

