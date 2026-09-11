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
      <CraftPhotoBand />
      <ExamplePostFeed />
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
//
// A plain editorial statement, not a bordered promo card. Previously this was a boxed
// card with a checklist restating the hero almost word for word, plus a progress bar
// that -- at 1 of 100 claimed -- visually undercut its own pitch ("barely anyone's
// here" reads louder than the bar's color ever could), plus a rocket-badge button.
// The only fact here that isn't already said in the hero is the real one: founding
// creators skip the $2k/mo wait entirely. Type scale carries the emphasis instead of
// a colored box, the same trick the hero's own "90-93%" already uses.
function FoundingPromoBanner({ stats }) {
  const soldOut = stats.remaining <= 0;

  return (
    <section className="border-y border-brand-ink/15 bg-brand-cream">
      <div className="mx-auto max-w-6xl px-6 py-11">
        <span className="text-xs font-extrabold uppercase tracking-wide text-[#B5613F]">
          Founding promo
        </span>
        <p className="mt-3 max-w-[26ch] font-display text-2xl font-bold leading-tight text-[#2B2420] sm:text-3xl">
          The first <span className="text-3xl font-extrabold text-brand-teal sm:text-4xl">{stats.limit}</span>{' '}
          creators keep <span className="text-3xl font-extrabold text-brand-teal sm:text-4xl">93%</span> from day
          one — everyone else earns their way there.
        </p>
        <p className="mt-3.5 max-w-lg text-brand-ink/70">
          Standard accounts reach our lowest fee once they&rsquo;re earning $2,000/mo. Founding creators
          start there.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          {soldOut ? (
            <p className="text-sm font-semibold text-brand-ink/70">
              All {stats.limit} founding spots have been claimed — standard rates now apply to new signups.
            </p>
          ) : (
            <>
              <a
                href="/signup?role=creator"
                className="border-b-2 border-brand-gold font-semibold text-brand-teal transition hover:text-[#0f4d45]"
              >
                Claim your spot →
              </a>
              <span className="text-sm font-medium tabular-nums text-brand-ink/60">
                <strong className="font-display text-base text-[#2B2420]">{stats.remaining}</strong> of{' '}
                {stats.limit} left
              </span>
            </>
          )}
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
// The "permanent 7% fee" card used to live here too, duplicating the fee stat the
// FoundingPromoBanner right above already states plainly -- cut, since the two
// sections back to back were making the same claim twice. These two cards each say
// something the banner doesn't: where you rank in Browse, and that follower count
// isn't the gate. Icons match the site's existing line-icon set (see PayoutIcon
// etc. below) instead of emoji.
function FoundersCircleSection({ stats }) {
  const soldOut = stats.remaining <= 0;
  const cards = [
    {
      icon: <RankIcon />,
      title: 'Priority placement',
      body: `Be a big fish in a small pond. Founding creators are automatically sorted first in Browse Creators and the homepage's featured section — for as long as you're here, before things get crowded.`,
    },
    {
      icon: <KeyIcon />,
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

      <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl border border-brand-ink/10 bg-brand-paper p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
              {c.icon}
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-[#2B2420]">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{c.body}</p>
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
            Claim your founding spot →
          </a>
        )}
      </div>
    </section>
  );
}

function Hero({ user }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    // Dark band fading down into the page's own cream -- the darker treatment the
    // mockup rounds settled on. Single column on purpose still: this used to split into
    // two columns with a decorative profile-preview card on the right, but that card was
    // doing a job the rest of the page now does better -- the photo band, the example
    // feed, and the calculator below all show real "here's what this looks like"
    // content, so the card in the hero was redundant. On mobile -- where outreach
    // traffic actually lands -- it also pushed the CTA and fine print below a card most
    // people would just scroll past. A tight single column gets to the button faster.
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0f201c] via-[#142c26] to-brand-cream">
      {/* Two blurred, ambiently drifting color blobs -- clay top-right, gold
          bottom-left -- give the dark band some depth instead of a flat fill. Purely
          decorative background motion, kept separate from the live-pulse dot on the
          demo button below (which is tied to something real); `motion-safe:` means
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

      <div className="relative mx-auto max-w-2xl px-6 pt-16 pb-24 text-left">
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

        {/* Preempts the "is that before or after Stripe takes its cut"
            question right where someone forms it — the fine-print answer
            already lives in StatsBand/FAQ further down, but a first-time
            visitor shouldn't have to scroll to find it. */}
        <p className="mt-3 font-display text-xl italic text-brand-paper/60">
          Stripe processing is covered on ByUs's platform fee.
        </p>

        <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-paper/75">
          Set up your page in a couple of minutes — tiers, posts, and payouts
          handled. Nothing hidden, no listing fee, and your rate only gets
          better as you grow.
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
              Start your own page →
            </a>
          )}

          {/* Lets a skeptical creator click through the whole product -- tiers,
              a locked post unlocking, the payout math -- before committing to an
              account, rather than taking the payout-rate pitch above on faith.
              A broadcast-style "live" dot instead of a sparkle emoji -- the
              emoji looked decorative and didn't actually read as "live." Border/
              fill are translucent paper now instead of solid teal, since a teal
              outline barely showed up against this teal-adjacent dark backdrop. */}
          <a
            href="/demo"
            className="inline-flex items-center gap-2.5 rounded-full border-2 border-brand-paper/30 bg-brand-paper/10 px-7 py-3 text-base font-semibold text-brand-paper backdrop-blur transition hover:border-brand-gold hover:bg-brand-paper/15"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-gold opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-gold" />
            </span>
            View Live Demo
          </a>
        </div>
        <p className="mt-2.5 text-sm text-brand-paper/50">No sign-up required to preview</p>

        <p className="mt-3 text-base font-semibold text-brand-paper/85">
          $0 to start&nbsp;&nbsp;·&nbsp;&nbsp;fee drops to 7% once you're earning $2k+/mo&nbsp;&nbsp;·&nbsp;&nbsp;cancel anytime
        </p>
      </div>
    </section>
  );
}

// Duotoned per-craft cards instead of stock photography. This first linked out to a
// placeholder face-photo service (pravatar.cc) -- those silently failed to load in
// some renders, which is worse than no photo at all, and a stranger's face standing
// in for "a ByUs creator" was never more than a stopgap regardless. Self-contained SVG
// icons can't break and don't imply any specific real person. Swap each card for real
// photography (licensed stock, or actual ByUs creators) the moment it exists.
function CraftPhotoBand() {
  const crafts = [
    { label: 'Ceramics', icon: <CeramicsIcon /> },
    { label: 'Music', icon: <MusicIcon /> },
    { label: 'Food', icon: <FoodIcon /> },
    { label: 'Illustration', icon: <IllustrationIcon /> },
    { label: 'Writing', icon: <WritingIcon /> },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-14 text-center">
      <h2 className="font-display text-3xl font-bold text-[#2B2420]">Built for every kind of creator</h2>
      <p className="mx-auto mt-2 max-w-md text-brand-ink/70">
        Placeholder art for now, standing in for real creator photography.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {crafts.map((c) => (
          <div
            key={c.label}
            className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-[#0e4a42] text-brand-paper shadow-md"
          >
            <span className="h-[42%] w-[42%] opacity-90">{c.icon}</span>
            <span className="absolute bottom-2.5 left-3 text-xs font-bold tracking-wide">{c.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// Example post cards -- illustrative content, not real ByUs creators or posts. The
// staggered layout (alternating cards nudged down on desktop) is what makes this read
// as an actual feed instead of a grid of features; a subscriber's real feed replaces
// these the moment creators are posting.
function ExamplePostFeed() {
  const posts = [
    {
      craft: 'Illustration',
      title: 'Character sketch process, start to finish',
      meta: '1 day ago · 22 comments',
      icon: <IllustrationIcon />,
      video: true,
    },
    {
      craft: 'Music',
      title: 'Studio session: laying down the bassline',
      meta: '3 days ago · 9 comments',
      icon: <MusicIcon />,
      video: true,
      lift: true,
    },
    {
      craft: 'Ceramics',
      title: 'Behind the glaze — testing a new celadon batch',
      meta: '5 days ago · 14 comments',
      icon: <CeramicsIcon />,
    },
    {
      craft: 'Food',
      title: "This week's menu development",
      meta: '6 days ago · 31 comments',
      icon: <FoodIcon />,
      lift: true,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-14 text-center">
      <span className="inline-block rounded-md bg-brand-teal/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-teal">
        Your feed, your rules
      </span>
      <h2 className="mt-3 font-display text-3xl font-bold text-[#2B2420]">What a subscriber actually sees</h2>
      <p className="mx-auto mt-2 max-w-md text-brand-ink/70">
        Example post cards — illustrative content, not real ByUs creators or posts.
      </p>
      <div className="mt-8 grid gap-4 text-left sm:grid-cols-4">
        {posts.map((p) => (
          <div
            key={p.title}
            className={`overflow-hidden rounded-2xl border border-brand-ink/15 bg-brand-paper shadow-sm ${
              p.lift ? 'sm:mt-8' : ''
            }`}
          >
            <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-clay to-[#b6613f]">
              <span className="h-[34%] w-[34%] text-brand-paper opacity-90">{p.icon}</span>
              {p.video && (
                <span className="absolute bottom-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-[10px] text-brand-paper">
                  ▶
                </span>
              )}
            </div>
            <div className="p-3.5">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-brand-teal">{p.craft}</div>
              <div className="mt-1 text-sm font-bold leading-snug text-[#2B2420]">{p.title}</div>
              <div className="mt-1.5 text-xs text-brand-ink/60">{p.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
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

// FoundersCircleSection icons -- same 24x24/1.8-stroke convention as the three above,
// sized to sit inside a fixed 44px icon tile.
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

// CraftPhotoBand / ExamplePostFeed icons -- these sit inside percentage-sized wrappers
// (h-[42%]/h-[34%] of a much larger card) rather than a fixed pixel box, so they use a
// 64x64 viewBox with no explicit width/height and scale with their container.
function CeramicsIcon() {
  return (
    <svg viewBox="0 0 64 64" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" className="h-full w-full">
      <path d="M25 12h14" />
      <path d="M27 12c-3 6-5 10-5 16 0 8 6 10 6 18 0 4-2 6-2 6h12s-2-2-2-6c0-8 6-10 6-18 0-6-2-10-5-16" />
      <path d="M18 52h28" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg viewBox="0 0 64 64" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" className="h-full w-full">
      <circle cx="24" cy="46" r="8" />
      <path d="M32 46V14l14 4v10" />
      <path d="M32 24l14 4" />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg viewBox="0 0 64 64" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" className="h-full w-full">
      <path d="M20 40c-5 0-8-4-8-8 0-4 3-7 6-7 0-5 4-9 9-9 3 0 5 1 7 3 2-3 5-4 8-4 5 0 9 4 9 9 4 0 7 3 7 7 0 4-3 8-8 8" />
      <path d="M20 40v10h24V40" />
      <path d="M20 46h24" />
    </svg>
  );
}

function IllustrationIcon() {
  return (
    <svg viewBox="0 0 64 64" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" className="h-full w-full">
      <path d="M42 12l10 10-28 28-12 3 3-12z" />
      <path d="M38 16l10 10" />
    </svg>
  );
}

function WritingIcon() {
  return (
    <svg viewBox="0 0 64 64" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" className="h-full w-full">
      <path d="M32 20c-4-4-10-6-18-6v34c8 0 14 2 18 6 4-4 10-6 18-6V14c-8 0-14 2-18 6z" />
      <path d="M32 20v34" />
    </svg>
  );
}
