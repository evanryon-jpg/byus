import { getCurrentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { getFoundingPromoStats } from '@/lib/fees';
import FAQSection from './components/FAQSection';
import CreatorSearch from './components/CreatorSearch';
import FeaturedCreators from './components/FeaturedCreators';
import EarningsCalculator from './components/EarningsCalculator';

// Server component so the hero and closing CTAs can tell whether someone is already
// logged in -- an existing creator or fan should never be invited to sign up again,
// they should be pointed straight back to the page they actually want.
export default async function HomePage() {
  const session = await getCurrentUser();
  const foundingStats = await getFoundingPromoStats(query);

  return (
    <div>
      <Hero user={session} />
      <FoundingPromoBanner stats={foundingStats} />
      <FoundersCircleSection stats={foundingStats} />
      <EarningsCalculator />
      <LookingForSomeoneSection />
      <FeaturedCreators />
      <StatsBand />
      <Features />
      <HowItWorks />
      <FAQSection />
      {/* PlatformGoalGauge (app/components/PlatformGoalGauge.jsx) pulled for now -- with
          one creator and no revenue yet, "our best month so far: $0.00" reads as a red
          flag to a visitor rather than a growth story. Bring it back once there's an
          actual best month worth showing. */}
      <ClosingCta user={session} />
    </div>
  );
}

// Launch offer -- see lib/fees.js for the actual billing logic this describes (founding
// creators skip the $2k/mo milestone entirely and sit at 7% from day one). `stats.remaining`
// is queried live, never hardcoded, so the count on the page can't drift from what a
// creator actually gets when they sign up.
function FoundingPromoBanner({ stats }) {
  const soldOut = stats.remaining <= 0;
  const pctClaimed = Math.round((stats.claimed / stats.limit) * 100);

  return (
    <section className="mx-auto max-w-6xl px-6 pb-4">
      <div className="overflow-hidden rounded-2xl border-2 border-brand-gold bg-[#FBF3E2]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-clay px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#F5E9D8]">
              🚀 Founding promo
            </span>

            <ul className="mt-4 space-y-1.5 text-base font-semibold text-brand-ink">
              <li className="flex gap-2">
                <span className="text-brand-teal">✓</span>
                You keep 90–93% of your revenue.
              </li>
              <li className="flex gap-2">
                <span className="text-brand-teal">✓</span>
                No hidden setup costs.
              </li>
            </ul>

            <p className="mt-4 max-w-lg text-brand-ink/75">
              We&rsquo;re waiving our standard milestones. The first {stats.limit} creators get our
              lowest {'7%'} fee tier instantly — no need to wait until you&rsquo;re earning $2k+/mo.
            </p>
          </div>

          <div className="rounded-xl border border-brand-ink/15 bg-brand-paper p-5">
            {soldOut ? (
              <p className="text-center text-sm font-semibold text-brand-ink/70">
                All {stats.limit} founding spots have been claimed — standard rates now apply to new signups.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between text-sm font-semibold text-brand-ink">
                  <span>{stats.remaining} founding spots left</span>
                  <span className="tabular-nums text-brand-ink/50">
                    {stats.claimed}/{stats.limit} claimed
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-ink/10">
                  <div
                    className="h-full rounded-full bg-brand-gold"
                    style={{ width: `${Math.max(pctClaimed, 3)}%` }}
                  />
                </div>
                <a
                  href="/signup?role=creator"
                  className="mt-4 block rounded-full bg-brand-teal px-6 py-3 text-center text-sm font-semibold text-brand-paper shadow-sm transition hover:bg-[#0f4d45]"
                >
                  🚀 Set this up
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// The creator-recruitment pitch for the founding promo above -- a dedicated section
// rather than a rewrite of the top Hero, since the Hero pitches BOTH fans and creators
// (the fee line applies to everyone browsing) while this is creator-acquisition copy
// specifically. Every claim here has to stay true to what's actually live: the fee is
// a permanent 7% (not "0%" or "keep 100%"), the priority placement is real (see the
// is_founding ordering in /api/creators) but there's no editorial/human curation layer,
// and there's no brand-deal or UGC-gig matching feature on ByUs at all -- so none of
// that made it into this copy even though it showed up in the original pitch.
function FoundersCircleSection({ stats }) {
  const soldOut = stats.remaining <= 0;
  const cards = [
    {
      icon: '🚀',
      title: 'Priority placement',
      body: `Be a big fish in a small pond. Founding creators are automatically sorted first in Browse Creators and the homepage's featured section — for as long as you're here, before things get crowded.`,
    },
    {
      icon: '💎',
      title: 'A permanent 7% fee',
      body: `The first ${stats.limit} creators lock in our lowest 7% fee tier for life — instantly, no need to wait until you're earning $2k+/mo like everyone else.`,
      breakdown: [
        { label: 'Founding 100', value: 'Keep 93% immediately' },
        { label: 'Regular creators', value: 'Keep 90%' },
        { label: 'Growing creator', value: 'Keep 93% at $2k+/mo' },
      ],
    },
    {
      icon: '🎯',
      title: 'Built for skills, not metrics',
      body: `Zero followers required to start. Set up tiers, publish posts, and get paid directly by the fans who value your work — no follower minimum, no algorithm gatekeeping who gets to monetize.`,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 pb-8">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold text-[#2B2420]">Become a founding creator</h2>
        <p className="mx-auto mt-2 max-w-xl text-brand-ink/70">
          Monetize your creativity, not your follower count.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl border border-brand-ink/10 bg-brand-paper p-6">
            <span className="text-3xl" aria-hidden="true">{c.icon}</span>
            <h3 className="mt-3 font-display text-lg font-bold text-[#2B2420]">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{c.body}</p>
            {c.breakdown && (
              <dl className="mt-4 space-y-1.5 border-t border-brand-ink/10 pt-3">
                {c.breakdown.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="text-brand-ink/55">{row.label}</dt>
                    <dd className="text-right font-semibold text-brand-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        {soldOut ? (
          <p className="text-sm font-semibold text-brand-ink/70">
            All {stats.limit} founding spots have been claimed — standard rates now apply to new signups.
          </p>
        ) : (
          <a
            href="/signup?role=creator"
            className="inline-block rounded-full bg-brand-teal px-7 py-3.5 text-base font-semibold text-brand-paper shadow-sm transition hover:bg-[#0f4d45]"
          >
            🚀 Claim your founding spot →
          </a>
        )}
      </div>
    </section>
  );
}

function Hero({ user }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    <section className="overflow-hidden">
      {/* Asymmetric split — pitch/CTA on the left, a live preview of what a
          creator's page actually looks like on the right. Leads with the payout
          rate rather than "browse creators": with only a handful of creators live
          so far, a stranger landing here has almost nothing to search for yet, but
          every creator sizing up the platform cares immediately about what they'd
          keep. The search box that used to open this section now lives further
          down the page, after the earnings numbers, so it's there for anyone who
          wants it without competing with the primary pitch for the first look. */}
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex -rotate-2 items-center gap-2 rounded border border-dashed border-brand-clay bg-[#F5E9D8] px-4 py-1.5 font-display text-xs font-semibold italic tracking-wide text-[#B5613F]">
              Made for creators, built around fairness
            </span>

            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-[#2B2420] sm:text-5xl lg:text-[3.25rem]">
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

            {/* Preempts the "is that before or after Stripe takes its cut"
                question right where someone forms it — the fine-print answer
                already lives in StatsBand/FAQ further down, but a first-time
                visitor shouldn't have to scroll to find it. */}
            <p className="mt-3 font-display text-xl italic text-brand-ink/60">
              Stripe processing is covered on ByUs's platform fee.
            </p>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-ink/70">
              Set up your page in a couple of minutes — tiers, posts, and payouts
              handled. Nothing hidden, no listing fee, and your rate only gets
              better as you grow.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {user ? (
                <a
                  href={dashboardHref}
                  className="rounded-full bg-brand-teal px-7 py-3.5 text-base font-semibold text-brand-paper shadow-sm transition hover:bg-[#0f4d45]"
                >
                  {user.role === 'creator' ? 'Go to your dashboard' : 'Your subscriptions'} →
                </a>
              ) : (
                <a
                  href="/signup?role=creator"
                  className="rounded-full bg-brand-teal px-7 py-3.5 text-base font-semibold text-brand-paper shadow-sm transition hover:bg-[#0f4d45]"
                >
                  Start your own page →
                </a>
              )}

              {/* Lets a skeptical creator click through the whole product -- tiers,
                  a locked post unlocking, the payout math -- before committing to an
                  account, rather than taking the payout-rate pitch above on faith. */}
              <a
                href="/demo"
                className="rounded-full border-2 border-brand-teal px-7 py-3 text-base font-semibold text-brand-teal transition hover:bg-brand-teal/10"
              >
                ✨ View Live Demo (No Sign-Up Required)
              </a>
            </div>

            <p className="mt-4 text-base font-semibold text-brand-ink">
              $0 to start&nbsp;&nbsp;·&nbsp;&nbsp;fee drops to 7% once you're earning $2k+/mo&nbsp;&nbsp;·&nbsp;&nbsp;cancel anytime
            </p>
          </div>

          <ProfilePreview />
        </div>
      </div>
    </section>
  );
}

// A purely decorative stand-in for a real creator's page -- shows a fan what they're
// about to get (banner, tiers, pick of one "most popular" plan) instead of the old
// fanned-swatch motif that only gestured at "there's a tier for every kind of
// supporter." Not tied to any real creator or account.
function ProfilePreview() {
  const tiers = [
    { name: 'Supporter', price: '$5.00/mo' },
    { name: 'Fan club', price: '$10.00/mo', popular: true },
    { name: 'VIP', price: '$25.00/mo' },
  ];

  return (
    <div className="mx-auto w-full max-w-sm rotate-1 rounded-2xl border border-brand-ink/20 bg-brand-paper shadow-xl shadow-brand-ink/10">
      <div
        className="h-20 rounded-t-2xl"
        style={{
          background: 'repeating-linear-gradient(115deg, #C97C5D 0 60px, #C9A961 60px 120px, #146359 120px 180px)',
        }}
        aria-hidden="true"
      />
      <div className="-mt-8 px-6 pb-6">
        <div className="flex h-14 w-14 -rotate-3 items-center justify-center rounded-2xl border-4 border-brand-paper bg-[#0f4d45] font-display text-2xl font-bold text-[#F5E9D8]">
          M
        </div>
        <p className="mt-3 font-display text-lg font-bold text-[#2B2420]">Mara Lindqvist</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['TikTok', 'YouTube', 'Instagram'].map((s) => (
            <span
              key={s}
              className="rounded border border-brand-ink/20 bg-[#F5E9D8] px-2 py-1 text-[11px] font-bold text-brand-ink/65"
            >
              {s} ↗
            </span>
          ))}
        </div>
        <div className="mt-5 space-y-2">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm ${
                t.popular ? 'border-brand-gold bg-brand-gold/15' : 'border-brand-ink/15'
              }`}
            >
              {t.popular && (
                <span className="absolute -top-2.5 right-3 rotate-3 rounded bg-brand-clay px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#F5E9D8]">
                  Most popular
                </span>
              )}
              <span className="font-semibold text-[#2B2420]">{t.name}</span>
              <span className="font-semibold tabular-nums text-brand-teal">{t.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
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

function StatsBand() {
  const stats = [
    { value: '90%', label: "kept by the creator, every renewal — 93% once they've grown with us" },
    {
      value: '10% → 7%',
      label: 'platform fee — drops to 7% for any month you earn $2,000+ on ByUs; Stripe’s own processing comes out of our cut, never billed to you separately',
    },
    { value: '$0', label: 'to start; no listing or setup cost' },
  ];
  const tilts = ['-rotate-[1.1deg]', 'rotate-[0.8deg]', '-rotate-[0.6deg]'];

  return (
    <section className="border-y border-brand-ink/10 bg-brand-paper">
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-14 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`rounded-xl border border-brand-ink/20 bg-[#F5E9D8] px-6 py-6 text-center ${tilts[i % tilts.length]}`}
          >
            <div className="font-display text-4xl font-bold tabular-nums text-brand-teal">{s.value}</div>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-[#2B2420]">
          Everything a membership needs, nothing it doesn&rsquo;t
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-ink/70">
          No churn dashboards to configure — just the parts that make a subscription work.
        </p>
      </div>

      {/* Asymmetric rhythm instead of three uniform boxes -- Direct payouts gets the
          big 2/3 slot since Stripe Express payouts are the actual differentiator,
          the other two stack beside it rather than competing for equal weight. */}
      <div className="mt-14 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Feature
          big
          icon={<PayoutIcon />}
          accent="teal"
          title="Direct payouts"
          body="Each creator connects their own Stripe Express account and receives 90% of every charge automatically — rising to 93% for good once they've grown with us. This is the whole model, so it gets the room to say it plainly."
        />
        <div className="flex flex-col gap-6">
          <Feature
            icon={<TiersIcon />}
            accent="gold"
            title="Tiered memberships"
            body="Build one or more monthly tiers with custom names, descriptions, and prices. Fans pick what fits."
          />
          <Feature
            icon={<LockIcon />}
            accent="clay"
            title="Gated content"
            body="Post public or subscribers-only updates. Access turns off the moment a subscription lapses or is canceled."
          />
        </div>
      </div>
    </section>
  );
}

const accentClasses = {
  teal: { bg: 'bg-brand-teal/10', text: 'text-brand-teal' },
  gold: { bg: 'bg-brand-gold/15', text: 'text-[#8a6b2f]' },
  clay: { bg: 'bg-brand-clay/15', text: 'text-brand-clay' },
};

function Feature({ icon, accent, title, body, big }) {
  const c = accentClasses[accent];
  return (
    <div
      className={`group rounded-2xl border bg-brand-paper text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        big ? 'flex h-full flex-col justify-center border-brand-teal/30 p-8' : 'border-brand-ink/15 p-6'
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-xl ${c.bg} ${c.text} ${
          big ? 'h-14 w-14' : 'h-11 w-11'
        }`}
      >
        {icon}
      </div>
      <h3 className={`mt-4 font-semibold text-[#2B2420] ${big ? 'text-xl' : ''}`}>{title}</h3>
      <p className={`mt-2 leading-relaxed text-brand-ink/70 ${big ? 'max-w-md text-base' : 'text-sm'}`}>{body}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Set up your page',
      body: 'Add a bio, a photo, and one or more monthly tiers with your own pricing.',
    },
    {
      n: '02',
      title: 'Connect Stripe',
      body: 'Link your own Stripe Express account once — payouts land there directly, every time.',
    },
    {
      n: '03',
      title: 'Share and post',
      body: 'Publish public updates to bring people in, and subscriber-only posts to reward them for joining.',
    },
  ];
  return (
    <section className="bg-brand-paper">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="text-center font-display text-3xl font-semibold text-[#2B2420]">
          Up and running in three steps
        </h2>

        <div className="mt-14 grid gap-10 sm:grid-cols-3">
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

function PayoutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" strokeLinecap="round" />
      <path d="M12 3l3.5 3.5" strokeLinecap="round" />
      <path d="M12 3l-3.5 3.5" strokeLinecap="round" />
      <path d="M12 3v6" strokeLinecap="round" />
    </svg>
  );
}

function TiersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" strokeLinejoin="round" />
      <path d="M3 18l9 5 9-5" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
